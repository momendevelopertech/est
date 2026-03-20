import {
  AssignmentMethod,
  AssignmentStatus,
  Prisma,
  SessionStatus,
  WaitingListStatus,
  type PrismaClient
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { createAssignmentInTransaction } from "@/lib/assignments/service";
import { isUserBlockedState } from "@/lib/blocks/state";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { executeNotificationTrigger } from "@/lib/notifications/triggers/service";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";
import { createBilingualSearchFilter } from "@/lib/search/bilingual";
import { getDerivedSessionStatus } from "@/lib/sessions/status";

import type {
  WaitingListCreateContract,
  WaitingListListContract,
  WaitingListPromoteContract,
  WaitingListRemoveContract
} from "./contracts";
import type {
  CreateWaitingListEntryInput,
  PromoteWaitingListEntryInput,
  RemoveWaitingListEntryInput,
  WaitingListListQuery
} from "./validation";

type ActivityClient = Prisma.TransactionClient | PrismaClient;

type SessionRecord = Prisma.SessionGetPayload<{
  select: typeof waitingListSessionSelect;
}>;

const waitingListSessionSelect = {
  id: true,
  cycleId: true,
  name: true,
  nameEn: true,
  examType: true,
  status: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  cycle: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      code: true,
      isActive: true
    }
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

const waitingListUserSelect = {
  id: true,
  name: true,
  nameEn: true,
  phone: true,
  averageRating: true,
  totalSessions: true,
  blockStatus: true,
  blockEndsAt: true,
  isActive: true
} satisfies Prisma.UserSelect;

const waitingListSelect = {
  id: true,
  sessionId: true,
  cycleId: true,
  userId: true,
  buildingId: true,
  roleDefinitionId: true,
  priority: true,
  status: true,
  entrySource: true,
  reason: true,
  notes: true,
  promotedAt: true,
  removedAt: true,
  createdAt: true,
  updatedAt: true,
  session: {
    select: waitingListSessionSelect
  },
  cycle: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      code: true
    }
  },
  user: {
    select: waitingListUserSelect
  },
  building: {
    select: {
      id: true,
      code: true,
      name: true,
      nameEn: true,
      isActive: true
    }
  },
  roleDefinition: {
    select: {
      id: true,
      key: true,
      name: true,
      nameEn: true,
      scope: true,
      manualOnly: true,
      isActive: true
    }
  }
} satisfies Prisma.WaitingListSelect;

export class WaitingListServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "WaitingListServiceError";
  }
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2025") {
    throw new WaitingListServiceError(
      ERROR_CODES.waitingListEntryNotFound,
      404,
      "Waiting-list entry not found."
    );
  }

  if (isKnownPrismaError(error) && error.code === "P2002") {
    throw new WaitingListServiceError(
      ERROR_CODES.duplicateWaitingListEntry,
      409,
      "This user already has a waiting-list entry for the selected session.",
      error.meta ?? null
    );
  }

  throw error;
}

function createSearchFilter(search?: string) {
  const userFilter = createBilingualSearchFilter(search, ["phone"]);
  const sessionFilter = createBilingualSearchFilter(search);
  const roleFilter = createBilingualSearchFilter(search, ["key"]);
  const filters: Prisma.WaitingListWhereInput[] = [];

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
  } satisfies Prisma.WaitingListWhereInput;
}

async function assertSessionExists(client: ActivityClient, sessionId: string) {
  const session = await client.session.findUnique({
    where: {
      id: sessionId
    },
    select: waitingListSessionSelect
  });

  if (!session) {
    throw new WaitingListServiceError(
      ERROR_CODES.sessionNotFound,
      404,
      "Session not found."
    );
  }

  return session;
}

function assertSessionOperational(session: SessionRecord, now = new Date()) {
  const derivedStatus = getDerivedSessionStatus(session, now);

  if (!session.isActive || !session.cycle.isActive) {
    throw new WaitingListServiceError(
      ERROR_CODES.waitingListSessionNotOperational,
      409,
      "Waiting-list operations require an active session and active cycle.",
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
    session.status === SessionStatus.COMPLETED ||
    derivedStatus === SessionStatus.COMPLETED
  ) {
    throw new WaitingListServiceError(
      ERROR_CODES.waitingListSessionNotOperational,
      409,
      "Waiting-list operations are not allowed for completed or cancelled sessions.",
      {
        sessionId: session.id,
        sessionStatus: session.status,
        derivedStatus
      }
    );
  }
}

async function assertUserExists(client: ActivityClient, userId: string) {
  const user = await client.user.findUnique({
    where: {
      id: userId
    },
    select: waitingListUserSelect
  });

  if (!user || !user.isActive) {
    throw new WaitingListServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found."
    );
  }

  return user;
}

async function assertBuildingExists(client: ActivityClient, buildingId: string) {
  const building = await client.building.findUnique({
    where: {
      id: buildingId
    },
    select: {
      id: true,
      isActive: true
    }
  });

  if (!building || !building.isActive) {
    throw new WaitingListServiceError(
      ERROR_CODES.buildingNotFound,
      404,
      "Building not found."
    );
  }

  return building;
}

async function assertRoleDefinitionExists(client: ActivityClient, roleDefinitionId: string) {
  const roleDefinition = await client.assignmentRoleDefinition.findUnique({
    where: {
      id: roleDefinitionId
    },
    select: {
      id: true,
      isActive: true
    }
  });

  if (!roleDefinition || !roleDefinition.isActive) {
    throw new WaitingListServiceError(
      ERROR_CODES.roleDefinitionNotFound,
      404,
      "Role definition not found."
    );
  }

  return roleDefinition;
}

function assertSessionBuildingLink(session: SessionRecord, buildingId: string) {
  if (session.buildings.some((link) => link.buildingId === buildingId)) {
    return;
  }

  throw new WaitingListServiceError(
    ERROR_CODES.waitingListSessionMismatch,
    409,
    "The building is not linked to the selected session.",
    {
      sessionId: session.id,
      buildingId
    }
  );
}

async function assertNoAssignmentForSessionUser(
  client: ActivityClient,
  sessionId: string,
  userId: string
) {
  const existingAssignment = await client.assignment.findUnique({
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

  if (!existingAssignment) {
    return;
  }

  throw new WaitingListServiceError(
    ERROR_CODES.duplicateAssignment,
    409,
    "This user already has an assignment record for the selected session.",
    {
      assignmentId: existingAssignment.id,
      assignmentStatus: existingAssignment.status,
      sessionId,
      userId
    }
  );
}

async function assertNoWaitingListEntryForSessionUser(
  client: ActivityClient,
  sessionId: string,
  userId: string
) {
  const existing = await client.waitingList.findUnique({
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

  throw new WaitingListServiceError(
    ERROR_CODES.duplicateWaitingListEntry,
    409,
    "This user already has a waiting-list entry for the selected session.",
    {
      waitingListId: existing.id,
      waitingListStatus: existing.status,
      sessionId,
      userId
    }
  );
}

async function assertWaitingListEntryExists(client: ActivityClient, waitingListId: string) {
  const entry = await client.waitingList.findUnique({
    where: {
      id: waitingListId
    },
    select: waitingListSelect
  });

  if (!entry) {
    throw new WaitingListServiceError(
      ERROR_CODES.waitingListEntryNotFound,
      404,
      "Waiting-list entry not found."
    );
  }

  return entry;
}

function toNumber(value: Prisma.Decimal) {
  return Number(value.toString());
}

export async function rerankWaitingEntriesInTransaction(
  client: Prisma.TransactionClient,
  sessionId: string
) {
  const entries = await client.waitingList.findMany({
    where: {
      sessionId,
      status: WaitingListStatus.WAITING
    },
    select: {
      id: true,
      priority: true,
      createdAt: true,
      user: {
        select: {
          averageRating: true,
          totalSessions: true
        }
      }
    }
  });

  const sorted = [...entries].sort((a, b) => {
    const ratingDiff = toNumber(b.user.averageRating) - toNumber(a.user.averageRating);

    if (Math.abs(ratingDiff) > Number.EPSILON) {
      return ratingDiff;
    }

    const sessionsDiff = b.user.totalSessions - a.user.totalSessions;

    if (sessionsDiff !== 0) {
      return sessionsDiff;
    }

    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();

    if (createdDiff !== 0) {
      return createdDiff;
    }

    return a.id.localeCompare(b.id);
  });

  for (let index = 0; index < sorted.length; index += 1) {
    const desiredPriority = index + 1;

    if (sorted[index].priority === desiredPriority) {
      continue;
    }

    await client.waitingList.update({
      where: {
        id: sorted[index].id
      },
      data: {
        priority: desiredPriority
      }
    });
  }
}

export async function getWaitingListEntries(query: WaitingListListQuery) {
  const contractQuery: WaitingListListContract = query;
  const pagination = resolvePagination(contractQuery);
  const where = {
    ...(contractQuery.sessionId
      ? {
          sessionId: contractQuery.sessionId
        }
      : {}),
    ...(contractQuery.cycleId
      ? {
          cycleId: contractQuery.cycleId
        }
      : {}),
    ...(contractQuery.userId
      ? {
          userId: contractQuery.userId
        }
      : {}),
    ...(contractQuery.buildingId
      ? {
          buildingId: contractQuery.buildingId
        }
      : {}),
    ...(contractQuery.status
      ? {
          status: contractQuery.status
        }
      : {}),
    ...createSearchFilter(contractQuery.search)
  } satisfies Prisma.WaitingListWhereInput;

  const [data, total] = await Promise.all([
    db.waitingList.findMany({
      where,
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: waitingListSelect
    }),
    db.waitingList.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getWaitingListEntryById(waitingListId: string) {
  return assertWaitingListEntryExists(db, waitingListId);
}

export async function createWaitingListEntry(
  input: CreateWaitingListEntryInput,
  actorAppUserId: string
) {
  const contractInput: WaitingListCreateContract = {
    sessionId: input.sessionId,
    userId: input.userId,
    buildingId: input.buildingId,
    roleDefinitionId: input.roleDefinitionId,
    entrySource: input.entrySource,
    reason: input.reason,
    notes: input.notes
  };

  try {
    return await db.$transaction(
      async (tx) => {
        const session = await assertSessionExists(tx, contractInput.sessionId);
        assertSessionOperational(session);

        const user = await assertUserExists(tx, contractInput.userId);

        if (isUserBlockedState(user)) {
          throw new WaitingListServiceError(
            ERROR_CODES.userBlocked,
            409,
            "Blocked users cannot be added to waiting list.",
            {
              userId: user.id,
              blockStatus: user.blockStatus,
              blockEndsAt: user.blockEndsAt
            }
          );
        }

        if (contractInput.buildingId) {
          const building = await assertBuildingExists(tx, contractInput.buildingId);
          assertSessionBuildingLink(session, building.id);
        }

        if (contractInput.roleDefinitionId) {
          await assertRoleDefinitionExists(tx, contractInput.roleDefinitionId);
        }

        await assertNoAssignmentForSessionUser(tx, session.id, user.id);
        await assertNoWaitingListEntryForSessionUser(tx, session.id, user.id);

        const created = await tx.waitingList.create({
          data: {
            sessionId: session.id,
            cycleId: session.cycleId,
            userId: user.id,
            buildingId: contractInput.buildingId ?? null,
            roleDefinitionId: contractInput.roleDefinitionId ?? null,
            priority: 0,
            status: WaitingListStatus.WAITING,
            entrySource: normalizeOptionalText(contractInput.entrySource) ?? "manual",
            reason: normalizeOptionalText(contractInput.reason) ?? null,
            notes: normalizeOptionalText(contractInput.notes) ?? null,
            promotedAt: null,
            removedAt: null
          },
          select: waitingListSelect
        });

        await rerankWaitingEntriesInTransaction(tx, session.id);
        const hydrated = await assertWaitingListEntryExists(tx, created.id);

        await logActivity({
          client: tx,
          userId: actorAppUserId,
          action: "create",
          entityType: "waiting_list",
          entityId: hydrated.id,
          description: `Added ${hydrated.user.name} to waiting list for session ${hydrated.session.name}.`,
          metadata: {
            waitingListId: hydrated.id,
            sessionId: hydrated.sessionId,
            cycleId: hydrated.cycleId,
            userId: hydrated.userId,
            buildingId: hydrated.buildingId,
            roleDefinitionId: hydrated.roleDefinitionId,
            status: hydrated.status
          },
          afterPayload: hydrated
        });

        return hydrated;
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

function assertWaitingStatus(entry: Prisma.WaitingListGetPayload<{ select: typeof waitingListSelect }>) {
  if (entry.status === WaitingListStatus.WAITING) {
    return;
  }

  throw new WaitingListServiceError(
    ERROR_CODES.waitingListEntryNotWaiting,
    409,
    "Only waiting entries can be promoted or removed.",
    {
      waitingListId: entry.id,
      status: entry.status
    }
  );
}

type PromoteWaitingListEntryInTransactionOptions = {
  actorAppUserId?: string;
  shouldLogActivity: boolean;
};

export async function promoteWaitingListEntryInTransaction(
  tx: Prisma.TransactionClient,
  waitingListId: string,
  input: PromoteWaitingListEntryInput,
  options: PromoteWaitingListEntryInTransactionOptions
) {
  const contractInput: WaitingListPromoteContract = input;
  const before = await assertWaitingListEntryExists(tx, waitingListId);
  assertWaitingStatus(before);
  assertSessionOperational(before.session);

  const buildingId = contractInput.buildingId ?? before.buildingId ?? undefined;
  const roleDefinitionId =
    contractInput.roleDefinitionId ?? before.roleDefinitionId ?? undefined;

  if (!buildingId || !roleDefinitionId) {
    throw new WaitingListServiceError(
      ERROR_CODES.waitingListPromotionMissingPlacement,
      409,
      "Promotion requires role and building placement.",
      {
        waitingListId: before.id,
        buildingId: before.buildingId,
        roleDefinitionId: before.roleDefinitionId
      }
    );
  }

  const promotedAssignment = await createAssignmentInTransaction(tx, {
    sessionId: before.sessionId,
    userId: before.userId,
    buildingId,
    roleDefinitionId,
    floorId: contractInput.floorId,
    roomId: contractInput.roomId,
    assignedMethod: AssignmentMethod.MANUAL,
    status: AssignmentStatus.DRAFT,
    isManualOverride: false,
    overrideNote: contractInput.overrideNote
  });

  const promoted = await tx.waitingList.update({
    where: {
      id: before.id
    },
    data: {
      status: WaitingListStatus.PROMOTED,
      promotedAt: new Date(),
      removedAt: null,
      buildingId,
      roleDefinitionId
    },
    select: waitingListSelect
  });

  await rerankWaitingEntriesInTransaction(tx, before.sessionId);

  if (options.shouldLogActivity) {
    await logActivity({
      client: tx,
      userId: options.actorAppUserId,
      action: "promote",
      entityType: "waiting_list",
      entityId: promoted.id,
      description: `Promoted waiting-list entry for ${promoted.user.name} in session ${promoted.session.name}.`,
      metadata: {
        waitingListId: promoted.id,
        sessionId: promoted.sessionId,
        userId: promoted.userId,
        assignmentId: promotedAssignment.id,
        buildingId: promotedAssignment.buildingId,
        roleDefinitionId: promotedAssignment.roleDefinitionId
      },
      beforePayload: before,
      afterPayload: promoted
    });
  }

  await executeNotificationTrigger(
    {
      eventType: "waiting_list_promoted",
      payload: {
        waitingListId: promoted.id,
        assignmentId: promotedAssignment.id
      }
    },
    {
      actorAppUserId: options.actorAppUserId,
      client: tx
    }
  );

  return {
    entry: promoted,
    assignment: promotedAssignment
  };
}

export async function promoteWaitingListEntry(
  waitingListId: string,
  input: PromoteWaitingListEntryInput,
  actorAppUserId: string
) {
  try {
    return await db.$transaction(
      async (tx) =>
        promoteWaitingListEntryInTransaction(tx, waitingListId, input, {
          actorAppUserId,
          shouldLogActivity: true
        }),
      {
        maxWait: 10000,
        timeout: 30000
      }
    );
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function removeWaitingListEntry(
  waitingListId: string,
  input: RemoveWaitingListEntryInput,
  actorAppUserId: string
) {
  const contractInput: WaitingListRemoveContract = input;

  try {
    return await db.$transaction(
      async (tx) => {
        const before = await assertWaitingListEntryExists(tx, waitingListId);
        assertWaitingStatus(before);
        assertSessionOperational(before.session);

        const removed = await tx.waitingList.update({
          where: {
            id: before.id
          },
          data: {
            status: WaitingListStatus.REMOVED,
            removedAt: new Date(),
            reason: normalizeOptionalText(contractInput.reason) ?? before.reason,
            notes: normalizeOptionalText(contractInput.notes) ?? before.notes
          },
          select: waitingListSelect
        });

        await rerankWaitingEntriesInTransaction(tx, before.sessionId);

        await logActivity({
          client: tx,
          userId: actorAppUserId,
          action: "remove",
          entityType: "waiting_list",
          entityId: removed.id,
          description: `Removed waiting-list entry for ${removed.user.name} in session ${removed.session.name}.`,
          metadata: {
            waitingListId: removed.id,
            sessionId: removed.sessionId,
            userId: removed.userId,
            reason: removed.reason
          },
          beforePayload: before,
          afterPayload: removed
        });

        return removed;
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
