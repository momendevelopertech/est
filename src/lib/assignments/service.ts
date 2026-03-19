import {
  AssignmentMethod,
  AssignmentStatus,
  BlockStatus,
  OperationalRoleScope,
  Prisma,
  type PrismaClient,
  SessionStatus
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";
import { createBilingualSearchFilter } from "@/lib/search/bilingual";
import { getDerivedSessionStatus } from "@/lib/sessions/status";

import type {
  AssignmentEngineSnapshotContract,
  AssignmentListContract,
  AssignmentSessionContextContract
} from "./contracts";
import type { CreateAssignmentInput } from "./validation";

type ActivityClient = Prisma.TransactionClient | PrismaClient;

type RequireActiveOptions = {
  requireActive?: boolean;
};

type AssignmentCreationInput = {
  sessionId: string;
  userId: string;
  buildingId: string;
  floorId?: string;
  roomId?: string;
  roleDefinitionId: string;
  assignedMethod?: AssignmentMethod;
  status?: AssignmentStatus;
  isManualOverride?: boolean;
  overrideNote?: string | null;
};

type AssignmentCreationOptions = {
  actorAppUserId?: string;
  shouldLogActivity: boolean;
};

const cycleSummarySelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  status: true,
  startDate: true,
  endDate: true,
  isActive: true
} satisfies Prisma.CycleSelect;

const buildingSummarySelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  isActive: true,
  universityId: true,
  university: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      governorateId: true,
      governorate: {
        select: {
          id: true,
          name: true,
          nameEn: true
        }
      }
    }
  }
} satisfies Prisma.BuildingSelect;

const floorSummarySelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  levelNumber: true,
  isActive: true,
  buildingId: true
} satisfies Prisma.FloorSelect;

const roomSummarySelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  roomType: true,
  supportedExamTypes: true,
  isActive: true,
  floorId: true,
  floor: {
    select: floorSummarySelect
  }
} satisfies Prisma.RoomSelect;

const sessionSummarySelect = {
  id: true,
  cycleId: true,
  name: true,
  nameEn: true,
  examType: true,
  status: true,
  startsAt: true,
  endsAt: true,
  sessionDate: true,
  isActive: true,
  cycle: {
    select: cycleSummarySelect
  },
  buildings: {
    where: {
      isActive: true
    },
    select: {
      buildingId: true
    }
  }
} satisfies Prisma.SessionSelect;

const userSummarySelect = {
  id: true,
  name: true,
  nameEn: true,
  phone: true,
  source: true,
  blockStatus: true,
  blockEndsAt: true,
  isActive: true
} satisfies Prisma.UserSelect;

const roleDefinitionSummarySelect = {
  id: true,
  key: true,
  name: true,
  nameEn: true,
  scope: true,
  manualOnly: true,
  isActive: true
} satisfies Prisma.AssignmentRoleDefinitionSelect;

const assignmentSelect = {
  id: true,
  sessionId: true,
  userId: true,
  buildingId: true,
  floorId: true,
  roomId: true,
  roleDefinitionId: true,
  status: true,
  assignedMethod: true,
  isManualOverride: true,
  overrideNote: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
  session: {
    select: sessionSummarySelect
  },
  user: {
    select: userSummarySelect
  },
  building: {
    select: buildingSummarySelect
  },
  floor: {
    select: floorSummarySelect
  },
  room: {
    select: roomSummarySelect
  },
  roleDefinition: {
    select: roleDefinitionSummarySelect
  }
} satisfies Prisma.AssignmentSelect;

type SessionRecord = Prisma.SessionGetPayload<{
  select: typeof sessionSummarySelect;
}>;

type UserRecord = Prisma.UserGetPayload<{
  select: typeof userSummarySelect;
}>;

type FloorRecord = Prisma.FloorGetPayload<{
  select: typeof floorSummarySelect;
}>;

type RoomRecord = Prisma.RoomGetPayload<{
  select: typeof roomSummarySelect;
}>;

export class AssignmentsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AssignmentsServiceError";
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

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2025") {
    throw new AssignmentsServiceError(
      ERROR_CODES.assignmentNotFound,
      404,
      "Assignment not found."
    );
  }

  if (isKnownPrismaError(error) && error.code === "P2002") {
    throw new AssignmentsServiceError(
      ERROR_CODES.duplicateAssignment,
      409,
      "This user already has an assignment for the selected session.",
      error.meta ?? null
    );
  }

  throw error;
}

function assertSessionAssignable(session: SessionRecord) {
  if (!session.isActive) {
    throw new AssignmentsServiceError(
      ERROR_CODES.assignmentSessionNotAssignable,
      409,
      "Assignments cannot target inactive sessions.",
      {
        sessionId: session.id
      }
    );
  }

  if (!session.cycle.isActive) {
    throw new AssignmentsServiceError(
      ERROR_CODES.inactiveParent,
      409,
      "Assignments cannot target sessions in inactive cycles.",
      {
        sessionId: session.id,
        cycleId: session.cycleId
      }
    );
  }

  const derivedStatus = getDerivedSessionStatus(session);

  if (
    session.status === SessionStatus.CANCELLED ||
    session.status === SessionStatus.COMPLETED ||
    derivedStatus === SessionStatus.IN_PROGRESS ||
    derivedStatus === SessionStatus.COMPLETED
  ) {
    throw new AssignmentsServiceError(
      ERROR_CODES.assignmentSessionNotAssignable,
      409,
      "Assignments are allowed only before session execution.",
      {
        sessionId: session.id,
        status: session.status,
        derivedStatus
      }
    );
  }
}

function assertSessionBuildingLink(session: SessionRecord, buildingId: string) {
  const linked = session.buildings.some((link) => link.buildingId === buildingId);

  if (linked) {
    return;
  }

  throw new AssignmentsServiceError(
    ERROR_CODES.assignmentLocationMismatch,
    409,
    "The building is not linked to the selected session.",
    {
      sessionId: session.id,
      buildingId
    }
  );
}

function assertRoleScopePlacement(
  scope: OperationalRoleScope,
  floorId: string | null,
  roomId: string | null
) {
  if (scope === OperationalRoleScope.BUILDING && (floorId || roomId)) {
    throw new AssignmentsServiceError(
      ERROR_CODES.assignmentRoleScopeViolation,
      409,
      "Building-scoped roles cannot target floors or rooms.",
      {
        scope,
        floorId,
        roomId
      }
    );
  }

  if (scope === OperationalRoleScope.FLOOR) {
    if (!floorId) {
      throw new AssignmentsServiceError(
        ERROR_CODES.assignmentRoleScopeViolation,
        409,
        "Floor-scoped roles require a floor.",
        {
          scope
        }
      );
    }

    if (roomId) {
      throw new AssignmentsServiceError(
        ERROR_CODES.assignmentRoleScopeViolation,
        409,
        "Floor-scoped roles cannot target rooms.",
        {
          scope,
          roomId
        }
      );
    }
  }

  if (scope === OperationalRoleScope.ROOM && !roomId) {
    throw new AssignmentsServiceError(
      ERROR_CODES.assignmentRoleScopeViolation,
      409,
      "Room-scoped roles require a room.",
      {
        scope
      }
    );
  }
}

function isUserBlocked(user: UserRecord, now = new Date()) {
  if (user.blockStatus === BlockStatus.PERMANENT) {
    return true;
  }

  if (user.blockStatus !== BlockStatus.TEMPORARY) {
    return false;
  }

  if (!user.blockEndsAt) {
    return true;
  }

  return now.getTime() < user.blockEndsAt.getTime();
}

async function assertSessionExists(
  client: ActivityClient,
  sessionId: string,
  options: RequireActiveOptions = {}
) {
  const session = await client.session.findUnique({
    where: {
      id: sessionId
    },
    select: sessionSummarySelect
  });

  if (!session) {
    throw new AssignmentsServiceError(
      ERROR_CODES.sessionNotFound,
      404,
      "Session not found."
    );
  }

  if (options.requireActive && !session.isActive) {
    throw new AssignmentsServiceError(
      ERROR_CODES.assignmentSessionNotAssignable,
      409,
      "Assignments cannot target inactive sessions.",
      {
        sessionId
      }
    );
  }

  return session;
}

async function assertUserExists(
  client: ActivityClient,
  userId: string,
  options: RequireActiveOptions = {}
) {
  const user = await client.user.findUnique({
    where: {
      id: userId
    },
    select: userSummarySelect
  });

  if (!user) {
    throw new AssignmentsServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found."
    );
  }

  if (options.requireActive && !user.isActive) {
    throw new AssignmentsServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found."
    );
  }

  return user;
}

async function assertRoleDefinitionExists(
  client: ActivityClient,
  roleDefinitionId: string,
  options: RequireActiveOptions = {}
) {
  const roleDefinition = await client.assignmentRoleDefinition.findUnique({
    where: {
      id: roleDefinitionId
    },
    select: roleDefinitionSummarySelect
  });

  if (!roleDefinition) {
    throw new AssignmentsServiceError(
      ERROR_CODES.roleDefinitionNotFound,
      404,
      "Role definition not found."
    );
  }

  if (options.requireActive && !roleDefinition.isActive) {
    throw new AssignmentsServiceError(
      ERROR_CODES.roleDefinitionNotFound,
      404,
      "Role definition not found."
    );
  }

  return roleDefinition;
}

async function assertBuildingExists(
  client: ActivityClient,
  buildingId: string,
  options: RequireActiveOptions = {}
) {
  const building = await client.building.findUnique({
    where: {
      id: buildingId
    },
    select: buildingSummarySelect
  });

  if (!building) {
    throw new AssignmentsServiceError(
      ERROR_CODES.buildingNotFound,
      404,
      "Building not found."
    );
  }

  if (options.requireActive && !building.isActive) {
    throw new AssignmentsServiceError(
      ERROR_CODES.buildingNotFound,
      404,
      "Building not found."
    );
  }

  return building;
}

async function assertFloorExists(
  client: ActivityClient,
  floorId: string,
  options: RequireActiveOptions = {}
) {
  const floor = await client.floor.findUnique({
    where: {
      id: floorId
    },
    select: floorSummarySelect
  });

  if (!floor) {
    throw new AssignmentsServiceError(
      ERROR_CODES.floorNotFound,
      404,
      "Floor not found."
    );
  }

  if (options.requireActive && !floor.isActive) {
    throw new AssignmentsServiceError(
      ERROR_CODES.floorNotFound,
      404,
      "Floor not found."
    );
  }

  return floor;
}

async function assertRoomExists(
  client: ActivityClient,
  roomId: string,
  options: RequireActiveOptions = {}
) {
  const room = await client.room.findUnique({
    where: {
      id: roomId
    },
    select: roomSummarySelect
  });

  if (!room) {
    throw new AssignmentsServiceError(
      ERROR_CODES.roomNotFound,
      404,
      "Room not found."
    );
  }

  if (options.requireActive && !room.isActive) {
    throw new AssignmentsServiceError(
      ERROR_CODES.roomNotFound,
      404,
      "Room not found."
    );
  }

  return room;
}

async function assertNoDuplicateAssignment(
  client: ActivityClient,
  sessionId: string,
  userId: string
) {
  const existing = await client.assignment.findUnique({
    where: {
      sessionId_userId: {
        sessionId,
        userId
      }
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!existing) {
    return;
  }

  throw new AssignmentsServiceError(
    ERROR_CODES.duplicateAssignment,
    409,
    "This user already has an assignment for the selected session.",
    {
      assignmentId: existing.id,
      status: existing.status,
      sessionId,
      userId
    }
  );
}

async function assertAssignmentExists(client: ActivityClient, assignmentId: string) {
  const assignment = await client.assignment.findUnique({
    where: {
      id: assignmentId
    },
    select: assignmentSelect
  });

  if (!assignment) {
    throw new AssignmentsServiceError(
      ERROR_CODES.assignmentNotFound,
      404,
      "Assignment not found."
    );
  }

  return assignment;
}

async function createAssignmentWithValidation(
  client: ActivityClient,
  input: AssignmentCreationInput,
  options: AssignmentCreationOptions
) {
  const session = await assertSessionExists(client, input.sessionId, {
    requireActive: true
  });
  assertSessionAssignable(session);

  const [user, roleDefinition, building] = await Promise.all([
    assertUserExists(client, input.userId, {
      requireActive: true
    }),
    assertRoleDefinitionExists(client, input.roleDefinitionId, {
      requireActive: true
    }),
    assertBuildingExists(client, input.buildingId, {
      requireActive: true
    })
  ]);

  if (isUserBlocked(user)) {
    throw new AssignmentsServiceError(
      ERROR_CODES.userBlocked,
      409,
      "Blocked users cannot receive assignments.",
      {
        userId: user.id,
        blockStatus: user.blockStatus,
        blockEndsAt: user.blockEndsAt
      }
    );
  }

  assertSessionBuildingLink(session, building.id);

  let room: RoomRecord | null = null;
  let floor: FloorRecord | null = null;
  let resolvedFloorId = input.floorId ?? null;

  if (input.roomId) {
    room = await assertRoomExists(client, input.roomId, {
      requireActive: true
    });
    resolvedFloorId = resolvedFloorId ?? room.floorId;

    if (room.floor.buildingId !== building.id) {
      throw new AssignmentsServiceError(
        ERROR_CODES.assignmentLocationMismatch,
        409,
        "Room must belong to the selected building.",
        {
          roomId: room.id,
          roomBuildingId: room.floor.buildingId,
          buildingId: building.id
        }
      );
    }

    if (!room.supportedExamTypes.includes(session.examType)) {
      throw new AssignmentsServiceError(
        ERROR_CODES.invalidExamType,
        409,
        "Room does not support the session exam type.",
        {
          roomId: room.id,
          examType: session.examType,
          supportedExamTypes: room.supportedExamTypes
        }
      );
    }
  }

  if (resolvedFloorId) {
    floor = await assertFloorExists(client, resolvedFloorId, {
      requireActive: true
    });

    if (floor.buildingId !== building.id) {
      throw new AssignmentsServiceError(
        ERROR_CODES.assignmentLocationMismatch,
        409,
        "Floor must belong to the selected building.",
        {
          floorId: floor.id,
          floorBuildingId: floor.buildingId,
          buildingId: building.id
        }
      );
    }
  }

  if (room && floor && room.floorId !== floor.id) {
    throw new AssignmentsServiceError(
      ERROR_CODES.assignmentLocationMismatch,
      409,
      "Room and floor must reference the same hierarchy path.",
      {
        floorId: floor.id,
        roomId: room.id,
        roomFloorId: room.floorId
      }
    );
  }

  assertRoleScopePlacement(roleDefinition.scope, resolvedFloorId, room?.id ?? null);

  const assignedMethod = input.assignedMethod ?? AssignmentMethod.MANUAL;

  if (roleDefinition.manualOnly && assignedMethod !== AssignmentMethod.MANUAL) {
    throw new AssignmentsServiceError(
      ERROR_CODES.invalidStatus,
      409,
      "This role definition supports manual assignment only.",
      {
        roleDefinitionId: roleDefinition.id,
        assignedMethod
      }
    );
  }

  await assertNoDuplicateAssignment(client, session.id, user.id);

  const created = await client.assignment.create({
    data: {
      sessionId: session.id,
      userId: user.id,
      buildingId: building.id,
      floorId: resolvedFloorId,
      roomId: room?.id ?? null,
      roleDefinitionId: roleDefinition.id,
      status: input.status ?? AssignmentStatus.DRAFT,
      assignedMethod,
      isManualOverride: input.isManualOverride ?? false,
      overrideNote: normalizeOptionalText(input.overrideNote) ?? null
    },
    select: assignmentSelect
  });

  if (options.shouldLogActivity) {
    await logActivity({
      client,
      userId: options.actorAppUserId,
      action: "create",
      entityType: "assignment",
      entityId: created.id,
      description: `Created assignment for session ${created.session.name}.`,
      metadata: {
        assignmentId: created.id,
        sessionId: created.sessionId,
        userId: created.userId,
        roleDefinitionId: created.roleDefinitionId,
        buildingId: created.buildingId,
        floorId: created.floorId,
        roomId: created.roomId,
        assignedMethod: created.assignedMethod
      },
      afterPayload: created
    });
  }

  return created;
}

export async function createAssignmentInTransaction(
  client: Prisma.TransactionClient,
  input: AssignmentCreationInput
) {
  return createAssignmentWithValidation(
    client,
    input,
    {
      shouldLogActivity: false
    }
  );
}

export async function createAssignment(input: CreateAssignmentInput, actorAppUserId: string) {
  try {
    return await db.$transaction(async (tx) =>
      createAssignmentWithValidation(
        tx,
        {
          ...input,
          assignedMethod: AssignmentMethod.MANUAL,
          status: AssignmentStatus.DRAFT,
          isManualOverride: false
        },
        {
          actorAppUserId,
          shouldLogActivity: true
        }
      )
    );
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function getAssignments(query: AssignmentListContract) {
  const pagination = resolvePagination(query);
  const where = {
    ...(query.sessionId
      ? {
          sessionId: query.sessionId
        }
      : {}),
    ...(query.userId
      ? {
          userId: query.userId
        }
      : {}),
    ...(query.buildingId
      ? {
          buildingId: query.buildingId
        }
      : {}),
    ...(query.roleDefinitionId
      ? {
          roleDefinitionId: query.roleDefinitionId
        }
      : {}),
    ...(query.status
      ? {
          status: query.status
        }
      : {}),
    ...(query.assignedMethod
      ? {
          assignedMethod: query.assignedMethod
        }
      : {}),
    ...createSearchFilter(query.search)
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
      select: assignmentSelect
    }),
    db.assignment.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getAssignmentById(assignmentId: string) {
  return assertAssignmentExists(db, assignmentId);
}

export async function cancelAssignment(assignmentId: string, actorAppUserId: string) {
  const before = await assertAssignmentExists(db, assignmentId);

  if (before.status === AssignmentStatus.COMPLETED) {
    throw new AssignmentsServiceError(
      ERROR_CODES.invalidStatus,
      409,
      "Completed assignments cannot be cancelled.",
      {
        assignmentId
      }
    );
  }

  if (before.status === AssignmentStatus.CANCELLED) {
    throw new AssignmentsServiceError(
      ERROR_CODES.invalidStatus,
      409,
      "Assignment is already cancelled.",
      {
        assignmentId
      }
    );
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.assignment.update({
        where: {
          id: assignmentId
        },
        data: {
          status: AssignmentStatus.CANCELLED
        },
        select: assignmentSelect
      });

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "cancel",
        entityType: "assignment",
        entityId: updated.id,
        description: `Cancelled assignment for session ${updated.session.name}.`,
        metadata: {
          assignmentId: updated.id,
          previousStatus: before.status,
          nextStatus: updated.status
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function getAssignmentEngineSnapshot(
  sessionId: string,
  roleDefinitionId: string
): Promise<AssignmentEngineSnapshotContract> {
  const [session, roleDefinition, existingAssignmentsCount] = await Promise.all([
    assertSessionExists(db, sessionId, {
      requireActive: true
    }),
    assertRoleDefinitionExists(db, roleDefinitionId, {
      requireActive: true
    }),
    db.assignment.count({
      where: {
        sessionId,
        roleDefinitionId,
        status: {
          not: AssignmentStatus.CANCELLED
        }
      }
    })
  ]);

  const context: AssignmentSessionContextContract = {
    sessionId: session.id,
    cycleId: session.cycleId,
    examType: session.examType,
    sessionStatus: session.status,
    buildingIds: session.buildings.map((link) => link.buildingId),
    startsAt: session.startsAt,
    endsAt: session.endsAt
  };

  return {
    session: context,
    role: {
      roleDefinitionId: roleDefinition.id,
      scope: roleDefinition.scope,
      manualOnly: roleDefinition.manualOnly
    },
    existingAssignmentsCount
  };
}
