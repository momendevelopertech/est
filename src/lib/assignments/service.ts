import {
  AssignmentMethod,
  AssignmentStatus,
  BlockStatus,
  ExamType,
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
  AutoAssignmentInputContract,
  AutoAssignmentResultContract,
  AutoAssignmentSlotContract,
  AssignmentEngineSnapshotContract,
  AssignmentListContract,
  AssignmentSessionContextContract,
  LateImportRerankInputContract,
  LateImportRerankResultContract,
  SessionPreLockValidationIssueContract,
  SessionPreLockValidationResultContract
} from "./contracts";
import type {
  AutoAssignAssignmentsInput,
  CreateAssignmentInput,
  LateImportRerankAssignmentsInput
} from "./validation";

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

function isUserBlocked(
  user: Pick<UserRecord, "blockStatus" | "blockEndsAt">,
  now = new Date()
) {
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

type AutoRoleDefinitionRecord = {
  id: string;
  key: string;
  scope: OperationalRoleScope;
  manualOnly: boolean;
  sortOrder: number;
};

type AutoCandidateUserRecord = {
  id: string;
};

type AutoSessionFloorRecord = {
  id: string;
  buildingId: string;
  levelNumber: number | null;
};

type AutoSessionRoomRecord = {
  id: string;
  floorId: string;
  floor: {
    buildingId: string;
    levelNumber: number | null;
  };
};

function resolveNumberSetting(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

async function getMinRatingThreshold(client: ActivityClient) {
  return getDistributionCountSetting(
    client,
    "distribution.min_rating_threshold",
    0
  );
}

async function getDistributionCountSetting(
  client: ActivityClient,
  key: string,
  fallback: number
) {
  const setting = await client.setting.findUnique({
    where: {
      key
    },
    select: {
      value: true
    }
  });
  const resolved = resolveNumberSetting(setting?.value, fallback);

  return Math.max(0, Math.floor(resolved));
}

function createSlotKey(slot: AutoAssignmentSlotContract) {
  return [
    slot.roleDefinitionId,
    slot.buildingId,
    slot.floorId ?? "",
    slot.roomId ?? ""
  ].join(":");
}

function buildAutoAssignmentSlots(input: {
  buildingIds: string[];
  roles: AutoRoleDefinitionRecord[];
  floors: AutoSessionFloorRecord[];
  rooms: AutoSessionRoomRecord[];
}) {
  const slots: AutoAssignmentSlotContract[] = [];
  const floorsByBuildingId = new Map<string, AutoSessionFloorRecord[]>();
  const roomsByBuildingId = new Map<string, AutoSessionRoomRecord[]>();

  for (const floor of input.floors) {
    const current = floorsByBuildingId.get(floor.buildingId) ?? [];
    current.push(floor);
    floorsByBuildingId.set(floor.buildingId, current);
  }

  for (const room of input.rooms) {
    const current = roomsByBuildingId.get(room.floor.buildingId) ?? [];
    current.push(room);
    roomsByBuildingId.set(room.floor.buildingId, current);
  }

  for (const role of input.roles) {
    for (const buildingId of input.buildingIds) {
      if (role.scope === OperationalRoleScope.BUILDING) {
        slots.push({
          roleDefinitionId: role.id,
          buildingId,
          floorId: null,
          roomId: null
        });
        continue;
      }

      if (role.scope === OperationalRoleScope.FLOOR) {
        const floors = floorsByBuildingId.get(buildingId) ?? [];

        for (const floor of floors) {
          slots.push({
            roleDefinitionId: role.id,
            buildingId,
            floorId: floor.id,
            roomId: null
          });
        }
        continue;
      }

      const rooms = roomsByBuildingId.get(buildingId) ?? [];

      for (const room of rooms) {
        slots.push({
          roleDefinitionId: role.id,
          buildingId,
          floorId: room.floorId,
          roomId: room.id
        });
      }
    }
  }

  return slots;
}

async function resolveAutoAssignableRoles(
  client: ActivityClient,
  roleDefinitionIds?: string[]
) {
  const where = roleDefinitionIds
    ? {
        id: {
          in: roleDefinitionIds
        },
        isActive: true
      }
    : {
        isActive: true
      };
  const roles = await client.assignmentRoleDefinition.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      scope: true,
      manualOnly: true,
      sortOrder: true
    }
  });

  if (roleDefinitionIds && roles.length !== roleDefinitionIds.length) {
    const roleIdSet = new Set(roles.map((role) => role.id));
    const missingRoleDefinitionIds = roleDefinitionIds.filter(
      (roleDefinitionId) => !roleIdSet.has(roleDefinitionId)
    );

    throw new AssignmentsServiceError(
      ERROR_CODES.roleDefinitionNotFound,
      404,
      "One or more role definitions were not found.",
      {
        roleDefinitionIds: missingRoleDefinitionIds
      }
    );
  }

  const manualRoles = roles.filter((role) => role.manualOnly);
  const autoRoles = roles.filter((role) => !role.manualOnly);

  return {
    roles: autoRoles,
    skippedManualRoleCount: manualRoles.length
  };
}

async function resolveAutoAssignmentCandidates(input: {
  client: ActivityClient;
  candidateUserIds?: string[];
  minRatingThreshold: number;
  session: SessionRecord;
  existingAssignedUserIds: string[];
}) {
  if (input.candidateUserIds && input.candidateUserIds.length > 0) {
    const requestedUsers = await input.client.user.findMany({
      where: {
        id: {
          in: input.candidateUserIds
        }
      },
      select: {
        id: true
      }
    });
    const requestedUserIdSet = new Set(requestedUsers.map((user) => user.id));
    const missingUserIds = input.candidateUserIds.filter(
      (candidateUserId) => !requestedUserIdSet.has(candidateUserId)
    );

    if (missingUserIds.length > 0) {
      throw new AssignmentsServiceError(
        ERROR_CODES.userNotFound,
        404,
        "One or more users were not found.",
        {
          userIds: missingUserIds
        }
      );
    }
  }

  const now = new Date();
  const baseCandidates = await input.client.user.findMany({
    where: {
      isActive: true,
      averageRating: {
        gte: input.minRatingThreshold
      },
      ...(input.candidateUserIds && input.candidateUserIds.length > 0
        ? {
            id: {
              in: input.candidateUserIds
            }
          }
        : {}),
      OR: [
        {
          blockStatus: BlockStatus.CLEAR
        },
        {
          blockStatus: BlockStatus.TEMPORARY,
          blockEndsAt: {
            lte: now
          }
        }
      ]
    },
    orderBy: [{ averageRating: "desc" }, { totalSessions: "asc" }, { createdAt: "asc" }],
    select: {
      id: true
    }
  });
  const existingAssignedUserIdSet = new Set(input.existingAssignedUserIds);
  let overlappingUserIdSet = new Set<string>();

  if (
    baseCandidates.length > 0 &&
    input.session.startsAt &&
    input.session.endsAt
  ) {
    const overlappingAssignments = await input.client.assignment.findMany({
      where: {
        userId: {
          in: baseCandidates.map((candidate) => candidate.id)
        },
        status: {
          not: AssignmentStatus.CANCELLED
        },
        sessionId: {
          not: input.session.id
        },
        session: {
          isActive: true,
          startsAt: {
            lt: input.session.endsAt
          },
          endsAt: {
            gt: input.session.startsAt
          }
        }
      },
      select: {
        userId: true
      }
    });
    overlappingUserIdSet = new Set(
      overlappingAssignments.map((assignment) => assignment.userId)
    );
  }

  const resolvedCandidates: AutoCandidateUserRecord[] = baseCandidates.filter(
    (candidate) =>
      !existingAssignedUserIdSet.has(candidate.id) &&
      !overlappingUserIdSet.has(candidate.id)
  );
  const skippedUserPoolCount = baseCandidates.length - resolvedCandidates.length;

  return {
    candidates: resolvedCandidates,
    skippedUserPoolCount
  };
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

type AutoAssignmentExecutionResult = AutoAssignmentResultContract & {
  candidateUserIdsUsed: string[];
  roleDefinitionIdsUsed: string[];
  sessionName: string;
  skippedAssnRoomRoleCount: number;
};

async function runAutoAssignSessionAssignments(
  tx: Prisma.TransactionClient,
  contractInput: AutoAssignmentInputContract,
  options: {
    shouldPersistAssignments: boolean;
    ignoredExistingAssignmentIds?: Set<string>;
  }
): Promise<AutoAssignmentExecutionResult> {
  const session = await assertSessionExists(tx, contractInput.sessionId, {
    requireActive: true
  });
  assertSessionAssignable(session);

  const buildingIds = session.buildings.map((link) => link.buildingId);
  const ignoredExistingAssignmentIds =
    options.ignoredExistingAssignmentIds ?? new Set<string>();
  const [
    minRatingThreshold,
    roleResolution,
    sessionExistingAssignments,
    sessionAllAssignments
  ] = await Promise.all([
    getMinRatingThreshold(tx),
    resolveAutoAssignableRoles(tx, contractInput.roleDefinitionIds),
    tx.assignment.findMany({
      where: {
        sessionId: session.id,
        status: {
          not: AssignmentStatus.CANCELLED
        }
      },
      select: {
        id: true,
        userId: true,
        roleDefinitionId: true,
        buildingId: true,
        floorId: true,
        roomId: true
      }
    }),
    tx.assignment.findMany({
      where: {
        sessionId: session.id
      },
      select: {
        id: true,
        userId: true
      }
    })
  ]);
  const existingAssignments = sessionExistingAssignments.filter(
    (assignment) => !ignoredExistingAssignmentIds.has(assignment.id)
  );
  const existingAssignmentsCount = existingAssignments.length;
  const existingAssignedUserIds = Array.from(
    new Set(
      sessionAllAssignments
        .filter((assignment) => !ignoredExistingAssignmentIds.has(assignment.id))
        .map((assignment) => assignment.userId)
    )
  );
  const occupiedSlotKeys = new Set(
    existingAssignments.map((assignment) =>
      createSlotKey({
        roleDefinitionId: assignment.roleDefinitionId,
        buildingId: assignment.buildingId,
        floorId: assignment.floorId,
        roomId: assignment.roomId
      })
    )
  );
  const estAssnRoomRoles = roleResolution.roles.filter(
    (role) =>
      session.examType === ExamType.EST_ASSN &&
      role.scope === OperationalRoleScope.ROOM
  );
  const executableRoles =
    session.examType === ExamType.EST_ASSN
      ? roleResolution.roles.filter((role) => role.scope !== OperationalRoleScope.ROOM)
      : roleResolution.roles;
  const roleScopes = new Set(executableRoles.map((role) => role.scope));
  const shouldLoadFloors =
    buildingIds.length > 0 &&
    (roleScopes.has(OperationalRoleScope.FLOOR) ||
      roleScopes.has(OperationalRoleScope.ROOM));
  const shouldLoadRooms = buildingIds.length > 0 && roleScopes.has(OperationalRoleScope.ROOM);
  const [floors, rooms] = await Promise.all([
    shouldLoadFloors
      ? tx.floor.findMany({
          where: {
            buildingId: {
              in: buildingIds
            },
            isActive: true
          },
          orderBy: [{ buildingId: "asc" }, { levelNumber: "asc" }, { id: "asc" }],
          select: {
            id: true,
            buildingId: true,
            levelNumber: true
          }
        })
      : Promise.resolve([] as AutoSessionFloorRecord[]),
    shouldLoadRooms
      ? tx.room.findMany({
          where: {
            isActive: true,
            supportedExamTypes: {
              has: session.examType
            },
            floor: {
              isActive: true,
              buildingId: {
                in: buildingIds
              }
            }
          },
          orderBy: [{ floorId: "asc" }, { id: "asc" }],
          select: {
            id: true,
            floorId: true,
            floor: {
              select: {
                buildingId: true,
                levelNumber: true
              }
            }
          }
        })
      : Promise.resolve([] as AutoSessionRoomRecord[])
  ]);
  const slots = buildAutoAssignmentSlots({
    buildingIds,
    roles: executableRoles,
    floors,
    rooms
  });
  const availableSlots = slots.filter((slot) => !occupiedSlotKeys.has(createSlotKey(slot)));
  const skippedExistingSlotCount = slots.length - availableSlots.length;
  const candidateResolution = await resolveAutoAssignmentCandidates({
    client: tx,
    candidateUserIds: contractInput.candidateUserIds,
    minRatingThreshold,
    session,
    existingAssignedUserIds
  });
  const plannedAssignments: AutoAssignmentResultContract["plannedAssignments"] = [];
  const remainingCandidates = [...candidateResolution.candidates];

  for (const slot of availableSlots) {
    const nextCandidate = remainingCandidates.shift();

    if (!nextCandidate) {
      break;
    }

    plannedAssignments.push({
      roleDefinitionId: slot.roleDefinitionId,
      buildingId: slot.buildingId,
      floorId: slot.floorId ?? null,
      roomId: slot.roomId ?? null,
      userId: nextCandidate.id
    });
  }

  const unfilledSlots = availableSlots.slice(plannedAssignments.length);
  const createdAssignmentIds: string[] = [];

  if (options.shouldPersistAssignments) {
    for (const plannedAssignment of plannedAssignments) {
      const createdAssignment = await createAssignmentInTransaction(tx, {
        sessionId: session.id,
        userId: plannedAssignment.userId,
        roleDefinitionId: plannedAssignment.roleDefinitionId,
        buildingId: plannedAssignment.buildingId,
        floorId: plannedAssignment.floorId ?? undefined,
        roomId: plannedAssignment.roomId ?? undefined,
        assignedMethod: AssignmentMethod.AUTO,
        status: AssignmentStatus.DRAFT,
        isManualOverride: false
      });
      createdAssignmentIds.push(createdAssignment.id);
    }
  }

  return {
    sessionId: session.id,
    dryRun: !options.shouldPersistAssignments,
    settings: {
      minRatingThreshold
    },
    roleCount: executableRoles.length,
    totalSlots: slots.length,
    existingAssignmentsCount,
    plannedAssignmentsCount: plannedAssignments.length,
    createdAssignmentsCount: createdAssignmentIds.length,
    unfilledSlotsCount: unfilledSlots.length,
    skippedManualRoleCount:
      roleResolution.skippedManualRoleCount + estAssnRoomRoles.length,
    skippedExistingSlotCount,
    skippedUserPoolCount: candidateResolution.skippedUserPoolCount,
    plannedAssignments,
    unfilledSlots,
    createdAssignmentIds,
    sessionName: session.name,
    roleDefinitionIdsUsed: executableRoles.map((role) => role.id),
    candidateUserIdsUsed: candidateResolution.candidates.map((candidate) => candidate.id),
    skippedAssnRoomRoleCount: estAssnRoomRoles.length
  };
}

export async function autoAssignSessionAssignments(
  input: AutoAssignAssignmentsInput,
  actorAppUserId: string
): Promise<AutoAssignmentResultContract> {
  const contractInput: AutoAssignmentInputContract = {
    sessionId: input.sessionId,
    roleDefinitionIds: input.roleDefinitionIds,
    candidateUserIds: input.candidateUserIds,
    dryRun: input.dryRun ?? false
  };

  try {
    const result = await db.$transaction(
      async (tx) => {
        const execution = await runAutoAssignSessionAssignments(tx, contractInput, {
          shouldPersistAssignments: !contractInput.dryRun
        });

        if (!contractInput.dryRun) {
          await logActivity({
            client: tx,
            userId: actorAppUserId,
            action: "auto_assign",
            entityType: "assignment",
            entityId: execution.sessionId,
            description: `Auto-assigned proctors for session ${execution.sessionName}.`,
            metadata: {
              sessionId: execution.sessionId,
              dryRun: false,
              roleDefinitionIds: contractInput.roleDefinitionIds ?? [],
              candidateUserIds: contractInput.candidateUserIds ?? [],
              roleCount: execution.roleCount,
              totalSlots: execution.totalSlots,
              existingAssignmentsCount: execution.existingAssignmentsCount,
              plannedAssignmentsCount: execution.plannedAssignmentsCount,
              createdAssignmentsCount: execution.createdAssignmentsCount,
              unfilledSlotsCount: execution.unfilledSlotsCount,
              skippedManualRoleCount: execution.skippedManualRoleCount,
              skippedExistingSlotCount: execution.skippedExistingSlotCount,
              skippedUserPoolCount: execution.skippedUserPoolCount,
              skippedAssnRoomRoleCount: execution.skippedAssnRoomRoleCount,
              minRatingThreshold: execution.settings.minRatingThreshold
            },
            afterPayload: {
              sessionId: execution.sessionId,
              createdAssignmentIds: execution.createdAssignmentIds
            }
          });
        }

        return execution;
      },
      {
        maxWait: 10000,
        timeout: 30000
      }
    );

    return {
      sessionId: result.sessionId,
      dryRun: result.dryRun,
      settings: result.settings,
      roleCount: result.roleCount,
      totalSlots: result.totalSlots,
      existingAssignmentsCount: result.existingAssignmentsCount,
      plannedAssignmentsCount: result.plannedAssignmentsCount,
      createdAssignmentsCount: result.createdAssignmentsCount,
      unfilledSlotsCount: result.unfilledSlotsCount,
      skippedManualRoleCount: result.skippedManualRoleCount,
      skippedExistingSlotCount: result.skippedExistingSlotCount,
      skippedUserPoolCount: result.skippedUserPoolCount,
      plannedAssignments: result.plannedAssignments,
      unfilledSlots: result.unfilledSlots,
      createdAssignmentIds: result.createdAssignmentIds
    };
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function rerankSessionAssignmentsForLateImport(
  input: LateImportRerankAssignmentsInput,
  actorAppUserId: string
): Promise<LateImportRerankResultContract> {
  const contractInput: LateImportRerankInputContract = {
    sessionId: input.sessionId,
    roleDefinitionIds: input.roleDefinitionIds,
    candidateUserIds: input.candidateUserIds,
    dryRun: input.dryRun ?? true
  };

  try {
    return await db.$transaction(
      async (tx) => {
        const session = await assertSessionExists(tx, contractInput.sessionId, {
          requireActive: true
        });
        assertSessionAssignable(session);

        const roleResolution = await resolveAutoAssignableRoles(
          tx,
          contractInput.roleDefinitionIds
        );
        const executableRoles =
          session.examType === ExamType.EST_ASSN
            ? roleResolution.roles.filter(
                (role) => role.scope !== OperationalRoleScope.ROOM
              )
            : roleResolution.roles;
        const executableRoleDefinitionIds = executableRoles.map((role) => role.id);
        const resettableAutoDraftAssignments =
          executableRoleDefinitionIds.length > 0
            ? await tx.assignment.findMany({
                where: {
                  sessionId: session.id,
                  status: AssignmentStatus.DRAFT,
                  assignedMethod: AssignmentMethod.AUTO,
                  isManualOverride: false,
                  roleDefinitionId: {
                    in: executableRoleDefinitionIds
                  }
                },
                select: {
                  id: true
                }
              })
            : [];
        const resettableAutoDraftAssignmentIds = resettableAutoDraftAssignments.map(
          (assignment) => assignment.id
        );
        const [preservedManualAssignmentCount, preservedNonDraftAutoAssignmentCount] =
          await Promise.all([
            tx.assignment.count({
              where: {
                sessionId: session.id,
                status: {
                  not: AssignmentStatus.CANCELLED
                },
                assignedMethod: AssignmentMethod.MANUAL
              }
            }),
            tx.assignment.count({
              where: {
                sessionId: session.id,
                status: {
                  notIn: [AssignmentStatus.CANCELLED, AssignmentStatus.DRAFT]
                },
                assignedMethod: AssignmentMethod.AUTO
              }
            })
          ]);

        if (!contractInput.dryRun && resettableAutoDraftAssignmentIds.length > 0) {
          await tx.assignment.deleteMany({
            where: {
              id: {
                in: resettableAutoDraftAssignmentIds
              }
            }
          });
        }

        const execution = await runAutoAssignSessionAssignments(
          tx,
          {
            sessionId: contractInput.sessionId,
            roleDefinitionIds: executableRoleDefinitionIds,
            candidateUserIds: contractInput.candidateUserIds,
            dryRun: contractInput.dryRun
          },
          {
            shouldPersistAssignments: !contractInput.dryRun,
            ignoredExistingAssignmentIds: contractInput.dryRun
              ? new Set(resettableAutoDraftAssignmentIds)
              : undefined
          }
        );

        if (!contractInput.dryRun) {
          await logActivity({
            client: tx,
            userId: actorAppUserId,
            action: "late_import_rerank",
            entityType: "assignment",
            entityId: session.id,
            description: `Re-ranked auto draft assignments for session ${session.name}.`,
            metadata: {
              sessionId: session.id,
              roleDefinitionIds: contractInput.roleDefinitionIds ?? [],
              candidateUserIds: contractInput.candidateUserIds ?? [],
              resetAssignmentsCount: resettableAutoDraftAssignmentIds.length,
              preservedManualAssignmentCount,
              preservedNonDraftAutoAssignmentCount,
              createdAssignmentsCount: execution.createdAssignmentsCount,
              plannedAssignmentsCount: execution.plannedAssignmentsCount,
              skippedAssnRoomRoleCount: execution.skippedAssnRoomRoleCount
            },
            afterPayload: {
              sessionId: session.id,
              resettableAutoDraftAssignmentIds,
              createdAssignmentIds: execution.createdAssignmentIds
            }
          });
        }

        return {
          sessionId: execution.sessionId,
          dryRun: contractInput.dryRun ?? true,
          resetAssignmentsCount: resettableAutoDraftAssignmentIds.length,
          resettableAutoDraftAssignmentIds,
          preservedManualAssignmentCount,
          preservedNonDraftAutoAssignmentCount,
          newlyAvailableCandidateUserIds: execution.candidateUserIdsUsed,
          autoAssignResult: {
            sessionId: execution.sessionId,
            dryRun: execution.dryRun,
            settings: execution.settings,
            roleCount: execution.roleCount,
            totalSlots: execution.totalSlots,
            existingAssignmentsCount: execution.existingAssignmentsCount,
            plannedAssignmentsCount: execution.plannedAssignmentsCount,
            createdAssignmentsCount: execution.createdAssignmentsCount,
            unfilledSlotsCount: execution.unfilledSlotsCount,
            skippedManualRoleCount: execution.skippedManualRoleCount,
            skippedExistingSlotCount: execution.skippedExistingSlotCount,
            skippedUserPoolCount: execution.skippedUserPoolCount,
            plannedAssignments: execution.plannedAssignments,
            unfilledSlots: execution.unfilledSlots,
            createdAssignmentIds: execution.createdAssignmentIds
          }
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

export async function validateSessionPreLock(
  sessionId: string
): Promise<SessionPreLockValidationResultContract> {
  return db.$transaction(
    async (tx) => {
      const session = await assertSessionExists(tx, sessionId, {
        requireActive: true
      });
      const buildingIds = session.buildings.map((link) => link.buildingId);
      const [
        requiredBuildingHeadCountPerBuilding,
        requiredFloorSeniorCountPerFloor,
        requiredFloorRoamingCountPerFloor,
        assignments,
        floors,
        rooms
      ] = await Promise.all([
        getDistributionCountSetting(
          tx,
          "distribution.required_building_head_per_building",
          1
        ),
        getDistributionCountSetting(
          tx,
          "distribution.required_floor_senior_per_floor",
          1
        ),
        getDistributionCountSetting(
          tx,
          "distribution.required_floor_roaming_per_floor",
          1
        ),
        tx.assignment.findMany({
          where: {
            sessionId: session.id,
            status: {
              not: AssignmentStatus.CANCELLED
            }
          },
          select: {
            id: true,
            userId: true,
            buildingId: true,
            floorId: true,
            roomId: true,
            assignedMethod: true,
            roleDefinition: {
              select: {
                id: true,
                key: true,
                scope: true,
                manualOnly: true
              }
            },
            user: {
              select: {
                blockStatus: true,
                blockEndsAt: true
              }
            }
          }
        }),
        buildingIds.length > 0
          ? tx.floor.findMany({
              where: {
                isActive: true,
                buildingId: {
                  in: buildingIds
                }
              },
              select: {
                id: true,
                buildingId: true
              }
            })
          : Promise.resolve([] as { id: string; buildingId: string }[]),
        buildingIds.length > 0
          ? tx.room.findMany({
              where: {
                isActive: true,
                supportedExamTypes: {
                  has: session.examType
                },
                floor: {
                  isActive: true,
                  buildingId: {
                    in: buildingIds
                  }
                }
              },
              select: {
                id: true,
                floorId: true,
                capacityMin: true,
                floor: {
                  select: {
                    buildingId: true
                  }
                }
              }
            })
          : Promise.resolve(
              [] as {
                id: string;
                floorId: string;
                capacityMin: number;
                floor: {
                  buildingId: string;
                };
              }[]
            )
      ]);
      const now = new Date();
      const issues: SessionPreLockValidationIssueContract[] = [];
      const assignmentIdsByUserId = new Map<string, string[]>();

      for (const assignment of assignments) {
        const current = assignmentIdsByUserId.get(assignment.userId) ?? [];
        current.push(assignment.id);
        assignmentIdsByUserId.set(assignment.userId, current);
      }

      for (const [userId, assignmentIds] of Array.from(
        assignmentIdsByUserId.entries()
      )) {
        if (assignmentIds.length < 2) {
          continue;
        }

        issues.push({
          code: "duplicate_assignment_in_session",
          message: "User has duplicate active assignments in this session.",
          userId,
          assignmentIds
        });
      }

      for (const assignment of assignments) {
        if (isUserBlocked(assignment.user, now)) {
          issues.push({
            code: "blocked_user_assigned",
            message: "Blocked users cannot remain assigned before locking the session.",
            assignmentId: assignment.id,
            userId: assignment.userId,
            buildingId: assignment.buildingId,
            floorId: assignment.floorId ?? undefined,
            roomId: assignment.roomId ?? undefined
          });
        }

        if (
          assignment.roleDefinition.manualOnly &&
          assignment.assignedMethod !== AssignmentMethod.MANUAL
        ) {
          issues.push({
            code: "manual_only_role_not_manual",
            message: "Manual-only role assignments must use the MANUAL method.",
            assignmentId: assignment.id,
            userId: assignment.userId,
            buildingId: assignment.buildingId,
            floorId: assignment.floorId ?? undefined,
            roomId: assignment.roomId ?? undefined
          });
        }
      }

      if (session.examType === ExamType.EST_ASSN) {
        for (const assignment of assignments) {
          if (
            assignment.roleDefinition.scope === OperationalRoleScope.ROOM &&
            assignment.assignedMethod !== AssignmentMethod.MANUAL
          ) {
            issues.push({
              code: "assn_room_not_manual",
              message: "EST ASSN room assignments must be manual-only.",
              assignmentId: assignment.id,
              userId: assignment.userId,
              buildingId: assignment.buildingId,
              floorId: assignment.floorId ?? undefined,
              roomId: assignment.roomId ?? undefined
            });
          }
        }
      }

      const roomScopedAssignmentsByRoomId = new Map<string, number>();

      for (const assignment of assignments) {
        if (
          assignment.roleDefinition.scope !== OperationalRoleScope.ROOM ||
          !assignment.roomId
        ) {
          continue;
        }

        roomScopedAssignmentsByRoomId.set(
          assignment.roomId,
          (roomScopedAssignmentsByRoomId.get(assignment.roomId) ?? 0) + 1
        );
      }

      for (const room of rooms) {
        if (room.capacityMin <= 0) {
          continue;
        }

        const roomAssignmentCount =
          roomScopedAssignmentsByRoomId.get(room.id) ?? 0;

        if (roomAssignmentCount >= room.capacityMin) {
          continue;
        }

        issues.push({
          code: "room_capacity_min_not_satisfied",
          message:
            "Room capacity minimum is not satisfied by active room-scoped assignments.",
          roomId: room.id,
          floorId: room.floorId,
          buildingId: room.floor.buildingId,
          expected: room.capacityMin,
          actual: roomAssignmentCount
        });
      }

      const participatingFloorIds = new Set(rooms.map((room) => room.floorId));
      const seniorCountByFloorId = new Map<string, number>();
      const roamingCountByFloorId = new Map<string, number>();
      const buildingHeadCountByBuildingId = new Map<string, number>();

      for (const assignment of assignments) {
        if (assignment.roleDefinition.key === "floor_senior" && assignment.floorId) {
          seniorCountByFloorId.set(
            assignment.floorId,
            (seniorCountByFloorId.get(assignment.floorId) ?? 0) + 1
          );
        }

        if (assignment.roleDefinition.key === "roaming_monitor" && assignment.floorId) {
          roamingCountByFloorId.set(
            assignment.floorId,
            (roamingCountByFloorId.get(assignment.floorId) ?? 0) + 1
          );
        }

        if (assignment.roleDefinition.key === "building_head") {
          buildingHeadCountByBuildingId.set(
            assignment.buildingId,
            (buildingHeadCountByBuildingId.get(assignment.buildingId) ?? 0) + 1
          );
        }
      }

      for (const floor of floors) {
        if (!participatingFloorIds.has(floor.id)) {
          continue;
        }

        const seniorCount = seniorCountByFloorId.get(floor.id) ?? 0;
        const roamingCount = roamingCountByFloorId.get(floor.id) ?? 0;

        if (seniorCount < requiredFloorSeniorCountPerFloor) {
          issues.push({
            code: "missing_floor_senior_coverage",
            message: "Floor senior coverage is below the required threshold.",
            buildingId: floor.buildingId,
            floorId: floor.id,
            expected: requiredFloorSeniorCountPerFloor,
            actual: seniorCount
          });
        }

        if (roamingCount < requiredFloorRoamingCountPerFloor) {
          issues.push({
            code: "missing_floor_roaming_coverage",
            message: "Floor roaming coverage is below the required threshold.",
            buildingId: floor.buildingId,
            floorId: floor.id,
            expected: requiredFloorRoamingCountPerFloor,
            actual: roamingCount
          });
        }
      }

      for (const buildingId of buildingIds) {
        const buildingHeadCount = buildingHeadCountByBuildingId.get(buildingId) ?? 0;

        if (buildingHeadCount >= requiredBuildingHeadCountPerBuilding) {
          continue;
        }

        issues.push({
          code: "missing_building_head_coverage",
          message: "Building head coverage is below the required threshold.",
          buildingId,
          expected: requiredBuildingHeadCountPerBuilding,
          actual: buildingHeadCount
        });
      }

      return {
        sessionId: session.id,
        isReady: issues.length === 0,
        checkedAt: now,
        settings: {
          requiredBuildingHeadCountPerBuilding,
          requiredFloorSeniorCountPerFloor,
          requiredFloorRoamingCountPerFloor
        },
        totals: {
          buildingCount: buildingIds.length,
          floorCount: floors.length,
          roomCount: rooms.length,
          activeAssignmentsCount: assignments.length
        },
        issues
      };
    },
    {
      maxWait: 10000,
      timeout: 30000
    }
  );
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

export async function listActiveAssignmentRoleDefinitions() {
  return db.assignmentRoleDefinition.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      nameEn: true,
      scope: true,
      manualOnly: true,
      sortOrder: true
    }
  });
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
