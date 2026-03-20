import {
  AssignmentStatus,
  AttendanceStatus,
  Prisma,
  type PrismaClient,
  SessionStatus,
  WaitingListStatus
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { AssignmentsServiceError } from "@/lib/assignments/service";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { executeNotificationTrigger } from "@/lib/notifications/triggers/service";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";
import { createBilingualSearchFilter } from "@/lib/search/bilingual";
import { getDerivedSessionStatus } from "@/lib/sessions/status";
import {
  promoteWaitingListEntryInTransaction,
  WaitingListServiceError
} from "@/lib/waiting-list/service";

import type {
  AttendanceListContract,
  AttendanceRecordContract,
  AttendanceReplacementSuggestionsContract,
  UpdateAttendanceContract
} from "./contracts";
import type { AttendanceListQuery, UpdateAttendanceInput } from "./validation";

type ActivityClient = Prisma.TransactionClient | PrismaClient;

const sessionSummarySelect = {
  id: true,
  cycleId: true,
  name: true,
  nameEn: true,
  status: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  cycle: {
    select: {
      id: true,
      isActive: true
    }
  }
} satisfies Prisma.SessionSelect;

const assignmentAttendanceSelect = {
  id: true,
  sessionId: true,
  userId: true,
  buildingId: true,
  floorId: true,
  roomId: true,
  roleDefinitionId: true,
  status: true,
  assignedMethod: true,
  assignedAt: true,
  updatedAt: true,
  overrideNote: true,
  session: {
    select: sessionSummarySelect
  },
  user: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      isActive: true
    }
  },
  building: {
    select: {
      id: true,
      name: true,
      nameEn: true
    }
  },
  floor: {
    select: {
      id: true,
      name: true,
      nameEn: true
    }
  },
  room: {
    select: {
      id: true,
      name: true,
      nameEn: true
    }
  },
  roleDefinition: {
    select: {
      id: true,
      key: true,
      name: true,
      nameEn: true,
      scope: true
    }
  },
  attendance: {
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      updatedByAppUserId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      updatedByAppUser: {
        select: {
          id: true,
          displayName: true,
          role: true
        }
      }
    }
  }
} satisfies Prisma.AssignmentSelect;

const waitingReplacementSelect = {
  id: true,
  sessionId: true,
  userId: true,
  status: true,
  priority: true,
  buildingId: true,
  roleDefinitionId: true,
  entrySource: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      averageRating: true,
      totalSessions: true
    }
  }
} satisfies Prisma.WaitingListSelect;

type AssignmentAttendanceRecord = Prisma.AssignmentGetPayload<{
  select: typeof assignmentAttendanceSelect;
}>;

type SessionRecord = Prisma.SessionGetPayload<{
  select: typeof sessionSummarySelect;
}>;

export class AttendanceServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AttendanceServiceError";
  }
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function createSearchFilter(search?: string) {
  const userFilter = createBilingualSearchFilter(search, ["phone"]);
  const sessionFilter = createBilingualSearchFilter(search);
  const roleFilter = createBilingualSearchFilter(search, ["key"]);
  const filters: Prisma.AssignmentWhereInput[] = [];

  if (userFilter) {
    filters.push({
      user: userFilter
    });
  }

  if (sessionFilter) {
    filters.push({
      session: sessionFilter
    });
  }

  if (roleFilter) {
    filters.push({
      roleDefinition: roleFilter
    });
  }

  if (filters.length === 0) {
    return undefined;
  }

  return {
    OR: filters
  } satisfies Prisma.AssignmentWhereInput;
}

function assertSessionAttendanceOperational(session: SessionRecord, now = new Date()) {
  const derivedStatus = getDerivedSessionStatus(session, now);
  const statusAllowsAttendance =
    session.status === SessionStatus.LOCKED ||
    session.status === SessionStatus.IN_PROGRESS ||
    session.status === SessionStatus.COMPLETED ||
    derivedStatus === SessionStatus.IN_PROGRESS ||
    derivedStatus === SessionStatus.COMPLETED;

  if (!session.isActive || !session.cycle.isActive) {
    throw new AttendanceServiceError(
      ERROR_CODES.attendanceSessionNotOperational,
      409,
      "Attendance updates require an active session in an active cycle.",
      {
        sessionId: session.id,
        cycleId: session.cycleId,
        isSessionActive: session.isActive,
        isCycleActive: session.cycle.isActive
      }
    );
  }

  if (
    session.status === SessionStatus.CANCELLED ||
    derivedStatus === SessionStatus.CANCELLED
  ) {
    throw new AttendanceServiceError(
      ERROR_CODES.attendanceSessionNotOperational,
      409,
      "Attendance updates are not allowed for cancelled sessions.",
      {
        sessionId: session.id,
        status: session.status,
        derivedStatus
      }
    );
  }

  if (!statusAllowsAttendance) {
    throw new AttendanceServiceError(
      ERROR_CODES.attendanceSessionNotOperational,
      409,
      "Attendance updates are allowed only after the session is locked.",
      {
        sessionId: session.id,
        status: session.status,
        derivedStatus
      }
    );
  }
}

function assertAssignmentOperationalForAttendance(assignment: AssignmentAttendanceRecord) {
  if (
    assignment.status !== AssignmentStatus.CANCELLED &&
    assignment.status !== AssignmentStatus.COMPLETED
  ) {
    return;
  }

  throw new AttendanceServiceError(
    ERROR_CODES.attendanceAssignmentNotOperational,
    409,
    "Attendance cannot be updated for cancelled or completed assignments.",
    {
      assignmentId: assignment.id,
      assignmentStatus: assignment.status
    }
  );
}

async function assertAssignmentExists(client: ActivityClient, assignmentId: string) {
  const assignment = await client.assignment.findUnique({
    where: {
      id: assignmentId
    },
    select: assignmentAttendanceSelect
  });

  if (!assignment) {
    throw new AttendanceServiceError(
      ERROR_CODES.assignmentNotFound,
      404,
      "Assignment not found."
    );
  }

  return assignment;
}

function toAttendanceRecord(input: AssignmentAttendanceRecord): AttendanceRecordContract {
  const attendance = input.attendance;

  return {
    assignmentId: input.id,
    assignmentStatus: input.status,
    attendanceId: attendance?.id ?? null,
    attendanceStatus: attendance?.status ?? AttendanceStatus.PENDING,
    checkedInAt: attendance?.checkedInAt ?? null,
    notes: attendance?.notes ?? null,
    updatedByAppUserId: attendance?.updatedByAppUserId ?? null,
    updatedAt: attendance?.updatedAt ?? input.updatedAt
  };
}

function resolveCheckedInAt(input: {
  status: AttendanceStatus;
  checkedInAt?: Date;
  previousCheckedInAt?: Date | null;
}) {
  if (input.status !== AttendanceStatus.CONFIRMED) {
    return null;
  }

  if (input.checkedInAt) {
    return input.checkedInAt;
  }

  if (input.previousCheckedInAt) {
    return input.previousCheckedInAt;
  }

  return new Date();
}

function normalizeMutationError(error: unknown): never {
  if (error instanceof AttendanceServiceError) {
    throw error;
  }

  if (error instanceof WaitingListServiceError) {
    throw new AttendanceServiceError(
      error.code,
      error.status,
      error.message,
      error.details
    );
  }

  if (error instanceof AssignmentsServiceError) {
    throw new AttendanceServiceError(
      error.code,
      error.status,
      error.message,
      error.details
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AttendanceServiceError(
      ERROR_CODES.uniqueConstraintViolation,
      409,
      "Attendance update violated a unique constraint.",
      error.meta ?? null
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new AttendanceServiceError(
      ERROR_CODES.attendanceNotFound,
      404,
      "Attendance record was not found."
    );
  }

  throw error;
}

export async function getAttendanceAssignments(query: AttendanceListQuery) {
  const contractQuery: AttendanceListContract = query;
  const pagination = resolvePagination(contractQuery);
  const attendanceFilter =
    contractQuery.status === AttendanceStatus.PENDING
      ? {
          OR: [
            {
              attendance: {
                is: null
              }
            },
            {
              attendance: {
                is: {
                  status: AttendanceStatus.PENDING
                }
              }
            }
          ]
        }
      : contractQuery.status
        ? {
            attendance: {
              is: {
                status: contractQuery.status
              }
            }
          }
        : {};
  const where = {
    ...(contractQuery.sessionId
      ? {
          sessionId: contractQuery.sessionId
        }
      : {}),
    ...(contractQuery.assignmentId
      ? {
          id: contractQuery.assignmentId
        }
      : {}),
    ...(contractQuery.userId
      ? {
          userId: contractQuery.userId
        }
      : {}),
    ...attendanceFilter,
    ...createSearchFilter(contractQuery.search)
  } satisfies Prisma.AssignmentWhereInput;

  const [data, total] = await Promise.all([
    db.assignment.findMany({
      where,
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: assignmentAttendanceSelect
    }),
    db.assignment.count({
      where
    })
  ]);

  return {
    data,
    attendance: data.map((record) => toAttendanceRecord(record)),
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getAttendanceReplacementSuggestions(
  query: AttendanceReplacementSuggestionsContract
) {
  const assignment = await assertAssignmentExists(db, query.assignmentId);
  assertAssignmentOperationalForAttendance(assignment);
  assertSessionAttendanceOperational(assignment.session);

  const waitingEntries = await db.waitingList.findMany({
    where: {
      sessionId: assignment.sessionId,
      status: WaitingListStatus.WAITING
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: waitingReplacementSelect
  });

  return waitingEntries
    .map((entry) => {
      const roleCompatible =
        !entry.roleDefinitionId || entry.roleDefinitionId === assignment.roleDefinitionId;
      const buildingCompatible =
        !entry.buildingId || entry.buildingId === assignment.buildingId;
      const compatibilityScore =
        (roleCompatible ? 0 : 10) + (buildingCompatible ? 0 : 5) + entry.priority;

      return {
        ...entry,
        compatibility: {
          roleCompatible,
          buildingCompatible,
          compatibilityScore
        }
      };
    })
    .sort(
      (a, b) =>
        a.compatibility.compatibilityScore - b.compatibility.compatibilityScore
    );
}

export async function updateAttendance(
  input: UpdateAttendanceInput,
  actorAppUserId: string
) {
  const contractInput: UpdateAttendanceContract = {
    assignmentId: input.assignmentId,
    status: input.status,
    notes: input.notes,
    checkedInAt: input.checkedInAt,
    replacementWaitingListId: input.replacementWaitingListId
  };

  try {
    return await db.$transaction(
      async (tx) => {
        const assignment = await assertAssignmentExists(tx, contractInput.assignmentId);
        assertAssignmentOperationalForAttendance(assignment);
        assertSessionAttendanceOperational(assignment.session);

        if (
          contractInput.replacementWaitingListId &&
          contractInput.status !== AttendanceStatus.ABSENT &&
          contractInput.status !== AttendanceStatus.DECLINED
        ) {
          throw new AttendanceServiceError(
            ERROR_CODES.attendanceReplacementInvalidStatus,
            409,
            "Replacement promotion is allowed only for absent or declined attendance statuses.",
            {
              assignmentId: assignment.id,
              status: contractInput.status,
              replacementWaitingListId: contractInput.replacementWaitingListId
            }
          );
        }

        const previousAttendance = assignment.attendance;
        const checkedInAt = resolveCheckedInAt({
          status: contractInput.status,
          checkedInAt: contractInput.checkedInAt,
          previousCheckedInAt: previousAttendance?.checkedInAt
        });

        const upsertedAttendance = await tx.attendance.upsert({
          where: {
            assignmentId: assignment.id
          },
          create: {
            assignmentId: assignment.id,
            status: contractInput.status,
            checkedInAt,
            notes: normalizeOptionalText(contractInput.notes) ?? null,
            updatedByAppUserId: actorAppUserId
          },
          update: {
            status: contractInput.status,
            checkedInAt,
            notes: normalizeOptionalText(contractInput.notes) ?? null,
            updatedByAppUserId: actorAppUserId
          },
          select: {
            id: true
          }
        });

        let replacementResult:
          | Awaited<ReturnType<typeof promoteWaitingListEntryInTransaction>>
          | undefined;

        if (contractInput.replacementWaitingListId) {
          replacementResult = await promoteWaitingListEntryInTransaction(
            tx,
            contractInput.replacementWaitingListId,
            {
              buildingId: assignment.buildingId,
              roleDefinitionId: assignment.roleDefinitionId,
              floorId: assignment.floorId ?? undefined,
              roomId: assignment.roomId ?? undefined,
              overrideNote: `attendance_replacement:${assignment.id}`
            },
            {
              actorAppUserId,
              shouldLogActivity: true
            }
          );

          await tx.assignment.update({
            where: {
              id: assignment.id
            },
            data: {
              status: AssignmentStatus.CANCELLED
            }
          });
        }

        const hydratedAssignment = await assertAssignmentExists(tx, assignment.id);
        const attendanceRecord = toAttendanceRecord(hydratedAssignment);

        await logActivity({
          client: tx,
          userId: actorAppUserId,
          action: "attendance_update",
          entityType: "attendance",
          entityId: upsertedAttendance.id,
          description: `Updated attendance for assignment ${assignment.id}.`,
          metadata: {
            assignmentId: assignment.id,
            sessionId: assignment.sessionId,
            previousStatus:
              previousAttendance?.status ?? AttendanceStatus.PENDING,
            nextStatus: contractInput.status,
            replacementWaitingListId:
              contractInput.replacementWaitingListId ?? null,
            replacementAssignmentId: replacementResult?.assignment.id ?? null
          },
          beforePayload: previousAttendance
            ? {
                attendanceId: previousAttendance.id,
                status: previousAttendance.status,
                checkedInAt: previousAttendance.checkedInAt,
                notes: previousAttendance.notes,
                updatedByAppUserId: previousAttendance.updatedByAppUserId
              }
            : null,
          afterPayload: {
            attendanceId: upsertedAttendance.id,
            status: attendanceRecord.attendanceStatus,
            checkedInAt: attendanceRecord.checkedInAt,
            notes: attendanceRecord.notes,
            updatedByAppUserId: attendanceRecord.updatedByAppUserId
          }
        });

        if (
          contractInput.status === AttendanceStatus.CONFIRMED ||
          contractInput.status === AttendanceStatus.ABSENT ||
          contractInput.status === AttendanceStatus.DECLINED
        ) {
          await executeNotificationTrigger(
            {
              eventType: "attendance_marked",
              payload: {
                assignmentId: assignment.id,
                attendanceStatus: contractInput.status
              }
            },
            {
              actorAppUserId,
              client: tx
            }
          );
        }

        return {
          assignment: hydratedAssignment,
          attendance: attendanceRecord,
          replacement: replacementResult
            ? {
                waitingListEntry: replacementResult.entry,
                assignment: replacementResult.assignment
              }
            : null
        };
      },
      {
        maxWait: 10000,
        timeout: 30000
      }
    );
  } catch (error) {
    normalizeMutationError(error);
  }
}
