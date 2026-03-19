import {
  AssignmentMethod,
  AssignmentStatus,
  Prisma,
  WaitingListStatus
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import {
  AssignmentsServiceError,
  findOverlappingAssignmentsInTransaction,
  getAssignableSessionInTransaction,
  isUserBlockedForAssignments
} from "@/lib/assignments/service";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { rerankWaitingEntriesInTransaction } from "@/lib/waiting-list/service";

import type {
  ExecuteSwapContract,
  SwapAssignmentSnapshotContract,
  SwapExecutionResultContract,
  SwapWaitingListSnapshotContract
} from "./contracts";
import type { ExecuteSwapInput } from "./validation";

const swapSessionSelect = {
  id: true,
  cycleId: true,
  name: true,
  status: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  cycle: {
    select: {
      id: true,
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

const swapAssignmentSelect = {
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
  session: {
    select: swapSessionSelect
  },
  user: {
    select: {
      id: true,
      name: true,
      isActive: true,
      blockStatus: true,
      blockEndsAt: true
    }
  }
} satisfies Prisma.AssignmentSelect;

const swapWaitingListSelect = {
  id: true,
  sessionId: true,
  userId: true,
  status: true,
  priority: true,
  buildingId: true,
  roleDefinitionId: true,
  entrySource: true,
  session: {
    select: swapSessionSelect
  },
  user: {
    select: {
      id: true,
      name: true,
      isActive: true,
      blockStatus: true,
      blockEndsAt: true
    }
  }
} satisfies Prisma.WaitingListSelect;

type SwapAssignmentRecord = Prisma.AssignmentGetPayload<{
  select: typeof swapAssignmentSelect;
}>;

type SwapWaitingListRecord = Prisma.WaitingListGetPayload<{
  select: typeof swapWaitingListSelect;
}>;

type SwapSessionRecord = Prisma.SessionGetPayload<{
  select: typeof swapSessionSelect;
}>;

type SwapUserRecord = {
  id: string;
  name: string;
  isActive: boolean;
  blockStatus: SwapAssignmentRecord["user"]["blockStatus"];
  blockEndsAt: Date | null;
};

export class SwapServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "SwapServiceError";
  }
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toAssignmentSnapshot(
  assignment: Pick<
    SwapAssignmentRecord,
    | "id"
    | "sessionId"
    | "userId"
    | "buildingId"
    | "floorId"
    | "roomId"
    | "roleDefinitionId"
    | "status"
    | "assignedMethod"
    | "isManualOverride"
    | "overrideNote"
  >
): SwapAssignmentSnapshotContract {
  return {
    id: assignment.id,
    sessionId: assignment.sessionId,
    userId: assignment.userId,
    buildingId: assignment.buildingId,
    floorId: assignment.floorId,
    roomId: assignment.roomId,
    roleDefinitionId: assignment.roleDefinitionId,
    status: assignment.status,
    assignedMethod: assignment.assignedMethod,
    isManualOverride: assignment.isManualOverride,
    overrideNote: assignment.overrideNote
  };
}

function toWaitingListSnapshot(
  entry: Pick<
    SwapWaitingListRecord,
    | "id"
    | "sessionId"
    | "userId"
    | "status"
    | "priority"
    | "buildingId"
    | "roleDefinitionId"
    | "entrySource"
  >
): SwapWaitingListSnapshotContract {
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    userId: entry.userId,
    status: entry.status,
    priority: entry.priority,
    buildingId: entry.buildingId,
    roleDefinitionId: entry.roleDefinitionId,
    entrySource: entry.entrySource
  };
}

function assertSessionMatches(inputSessionId: string, observedSessionId: string) {
  if (inputSessionId === observedSessionId) {
    return;
  }

  throw new SwapServiceError(
    ERROR_CODES.swapSessionMismatch,
    409,
    "Swap records must belong to the selected session.",
    {
      inputSessionId,
      observedSessionId
    }
  );
}

function assertAssignmentSwappable(assignment: SwapAssignmentRecord) {
  if (
    assignment.status !== AssignmentStatus.CANCELLED &&
    assignment.status !== AssignmentStatus.COMPLETED
  ) {
    return;
  }

  throw new SwapServiceError(
    ERROR_CODES.swapAssignmentNotSwappable,
    409,
    "Cancelled or completed assignments cannot be swapped.",
    {
      assignmentId: assignment.id,
      status: assignment.status
    }
  );
}

async function assertSwapAssignmentExists(
  tx: Prisma.TransactionClient,
  assignmentId: string
) {
  const assignment = await tx.assignment.findUnique({
    where: {
      id: assignmentId
    },
    select: swapAssignmentSelect
  });

  if (!assignment) {
    throw new SwapServiceError(
      ERROR_CODES.assignmentNotFound,
      404,
      "Assignment not found."
    );
  }

  return assignment;
}

async function assertSwapWaitingListExists(
  tx: Prisma.TransactionClient,
  waitingListId: string
) {
  const waitingEntry = await tx.waitingList.findUnique({
    where: {
      id: waitingListId
    },
    select: swapWaitingListSelect
  });

  if (!waitingEntry) {
    throw new SwapServiceError(
      ERROR_CODES.waitingListEntryNotFound,
      404,
      "Waiting-list entry not found."
    );
  }

  return waitingEntry;
}

async function assertReplacementUserExists(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<SwapUserRecord> {
  const user = await tx.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      blockStatus: true,
      blockEndsAt: true
    }
  });

  if (!user || !user.isActive) {
    throw new SwapServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found."
    );
  }

  return user;
}

function assertReplacementUserNotBlocked(user: SwapUserRecord) {
  if (!isUserBlockedForAssignments(user)) {
    return;
  }

  throw new SwapServiceError(
    ERROR_CODES.userBlocked,
    409,
    "Blocked users cannot be assigned through swap workflows.",
    {
      userId: user.id,
      blockStatus: user.blockStatus,
      blockEndsAt: user.blockEndsAt
    }
  );
}

async function assertNoAssignmentDuplicateForSessionUser(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    userId: string;
    ignoredAssignmentId?: string;
  }
) {
  const existing = await tx.assignment.findUnique({
    where: {
      sessionId_userId: {
        sessionId: input.sessionId,
        userId: input.userId
      }
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!existing || existing.id === input.ignoredAssignmentId) {
    return;
  }

  throw new SwapServiceError(
    ERROR_CODES.duplicateAssignment,
    409,
    "This user already has an assignment record for the selected session.",
    {
      sessionId: input.sessionId,
      userId: input.userId,
      assignmentId: existing.id,
      assignmentStatus: existing.status,
      ignoredAssignmentId: input.ignoredAssignmentId ?? null
    }
  );
}

async function assertNoWaitingListDuplicateForSessionUser(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    userId: string;
  }
) {
  const existing = await tx.waitingList.findUnique({
    where: {
      sessionId_userId: {
        sessionId: input.sessionId,
        userId: input.userId
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

  throw new SwapServiceError(
    ERROR_CODES.duplicateWaitingListEntry,
    409,
    "This user already has a waiting-list record for the selected session.",
    {
      sessionId: input.sessionId,
      userId: input.userId,
      waitingListId: existing.id,
      waitingListStatus: existing.status
    }
  );
}

async function assertNoOverlapForReplacement(
  tx: Prisma.TransactionClient,
  session: SwapSessionRecord,
  userId: string
) {
  const conflicts = await findOverlappingAssignmentsInTransaction(tx, {
    userIds: [userId],
    sessionId: session.id,
    startsAt: session.startsAt,
    endsAt: session.endsAt
  });

  if (conflicts.length === 0) {
    return;
  }

  throw new SwapServiceError(
    ERROR_CODES.swapOverlapConflict,
    409,
    "Replacement user has overlapping assignments in another session.",
    {
      userId,
      conflicts: conflicts.map((conflict) => ({
        assignmentId: conflict.id,
        sessionId: conflict.sessionId,
        status: conflict.status
      }))
    }
  );
}

async function maybeCreateDemotedWaitingEntry(
  tx: Prisma.TransactionClient,
  input: {
    session: SwapSessionRecord;
    ignoredAssignmentId?: string;
    userId: string;
    buildingId: string;
    roleDefinitionId: string;
    reason?: string;
    notes?: string;
  }
) {
  const user = await assertReplacementUserExists(tx, input.userId);
  assertReplacementUserNotBlocked(user);
  await assertNoAssignmentDuplicateForSessionUser(tx, {
    sessionId: input.session.id,
    userId: input.userId,
    ignoredAssignmentId: input.ignoredAssignmentId
  });
  await assertNoWaitingListDuplicateForSessionUser(tx, {
    sessionId: input.session.id,
    userId: input.userId
  });

  return tx.waitingList.create({
    data: {
      sessionId: input.session.id,
      cycleId: input.session.cycleId,
      userId: input.userId,
      buildingId: input.buildingId,
      roleDefinitionId: input.roleDefinitionId,
      priority: 0,
      status: WaitingListStatus.WAITING,
      entrySource: "swap_demotion",
      reason: normalizeOptionalText(input.reason) ?? "swap_demotion",
      notes: normalizeOptionalText(input.notes) ?? null
    },
    select: swapWaitingListSelect
  });
}

async function runDirectAssignmentSwap(
  tx: Prisma.TransactionClient,
  input: Extract<ExecuteSwapContract, { kind: "DIRECT_ASSIGNMENT_SWAP" }>
): Promise<SwapExecutionResultContract> {
  const [primary, secondary] = await Promise.all([
    assertSwapAssignmentExists(tx, input.primaryAssignmentId),
    assertSwapAssignmentExists(tx, input.secondaryAssignmentId)
  ]);

  assertSessionMatches(input.sessionId, primary.sessionId);
  assertSessionMatches(input.sessionId, secondary.sessionId);
  assertAssignmentSwappable(primary);
  assertAssignmentSwappable(secondary);
  await getAssignableSessionInTransaction(tx, input.sessionId);

  if (!input.manualOverride && primary.roleDefinitionId !== secondary.roleDefinitionId) {
    throw new SwapServiceError(
      ERROR_CODES.swapRoleMismatch,
      409,
      "Direct swaps require matching roles unless manual override is enabled.",
      {
        primaryAssignmentId: primary.id,
        secondaryAssignmentId: secondary.id,
        primaryRoleDefinitionId: primary.roleDefinitionId,
        secondaryRoleDefinitionId: secondary.roleDefinitionId
      }
    );
  }

  if (
    primary.buildingId === secondary.buildingId &&
    (primary.floorId ?? null) === (secondary.floorId ?? null) &&
    (primary.roomId ?? null) === (secondary.roomId ?? null) &&
    primary.roleDefinitionId === secondary.roleDefinitionId
  ) {
    throw new SwapServiceError(
      ERROR_CODES.swapNoOp,
      409,
      "Swap operation produced no placement change.",
      {
        primaryAssignmentId: primary.id,
        secondaryAssignmentId: secondary.id
      }
    );
  }

  const overrideNote = normalizeOptionalText(input.overrideNote) ?? null;
  const [updatedPrimary, updatedSecondary] = await Promise.all([
    tx.assignment.update({
      where: {
        id: primary.id
      },
      data: {
        buildingId: secondary.buildingId,
        floorId: secondary.floorId,
        roomId: secondary.roomId,
        roleDefinitionId: secondary.roleDefinitionId,
        assignedMethod: AssignmentMethod.MANUAL,
        isManualOverride: input.manualOverride ?? false,
        overrideNote
      },
      select: swapAssignmentSelect
    }),
    tx.assignment.update({
      where: {
        id: secondary.id
      },
      data: {
        buildingId: primary.buildingId,
        floorId: primary.floorId,
        roomId: primary.roomId,
        roleDefinitionId: primary.roleDefinitionId,
        assignedMethod: AssignmentMethod.MANUAL,
        isManualOverride: input.manualOverride ?? false,
        overrideNote
      },
      select: swapAssignmentSelect
    })
  ]);

  return {
    kind: input.kind,
    sessionId: input.sessionId,
    changedAssignmentIds: [updatedPrimary.id, updatedSecondary.id],
    assignments: [
      toAssignmentSnapshot(updatedPrimary),
      toAssignmentSnapshot(updatedSecondary)
    ]
  };
}

async function runWaitingListReplacement(
  tx: Prisma.TransactionClient,
  input: Extract<ExecuteSwapContract, { kind: "WAITING_LIST_REPLACEMENT" }>
): Promise<SwapExecutionResultContract> {
  const [assignment, waitingEntry] = await Promise.all([
    assertSwapAssignmentExists(tx, input.assignmentId),
    assertSwapWaitingListExists(tx, input.waitingListId)
  ]);

  assertSessionMatches(input.sessionId, assignment.sessionId);
  assertSessionMatches(input.sessionId, waitingEntry.sessionId);
  assertAssignmentSwappable(assignment);
  const session = await getAssignableSessionInTransaction(tx, input.sessionId);

  if (waitingEntry.status !== WaitingListStatus.WAITING) {
    throw new SwapServiceError(
      ERROR_CODES.waitingListEntryNotWaiting,
      409,
      "Only waiting entries can be used in swap replacement.",
      {
        waitingListId: waitingEntry.id,
        status: waitingEntry.status
      }
    );
  }

  if (!input.manualOverride) {
    if (
      waitingEntry.roleDefinitionId &&
      waitingEntry.roleDefinitionId !== assignment.roleDefinitionId
    ) {
      throw new SwapServiceError(
        ERROR_CODES.swapManualOverrideRequired,
        409,
        "Role mismatch requires manual override for waiting-list replacement.",
        {
          assignmentId: assignment.id,
          waitingListId: waitingEntry.id,
          assignmentRoleDefinitionId: assignment.roleDefinitionId,
          waitingRoleDefinitionId: waitingEntry.roleDefinitionId
        }
      );
    }

    if (waitingEntry.buildingId && waitingEntry.buildingId !== assignment.buildingId) {
      throw new SwapServiceError(
        ERROR_CODES.swapWaitingListMismatch,
        409,
        "Building mismatch requires manual override for waiting-list replacement.",
        {
          assignmentId: assignment.id,
          waitingListId: waitingEntry.id,
          assignmentBuildingId: assignment.buildingId,
          waitingBuildingId: waitingEntry.buildingId
        }
      );
    }
  }

  if (assignment.userId === waitingEntry.userId) {
    throw new SwapServiceError(
      ERROR_CODES.swapNoOp,
      409,
      "Replacement user is already assigned to this placement.",
      {
        assignmentId: assignment.id,
        userId: assignment.userId
      }
    );
  }

  const replacementUser = await assertReplacementUserExists(tx, waitingEntry.userId);
  assertReplacementUserNotBlocked(replacementUser);
  await assertNoAssignmentDuplicateForSessionUser(tx, {
    sessionId: session.id,
    userId: replacementUser.id,
    ignoredAssignmentId: assignment.id
  });
  await assertNoOverlapForReplacement(tx, session, replacementUser.id);

  let demotedWaitingEntry: SwapWaitingListRecord | undefined;

  if (input.demoteCurrentAssignee ?? true) {
    demotedWaitingEntry = await maybeCreateDemotedWaitingEntry(tx, {
      session,
      ignoredAssignmentId: assignment.id,
      userId: assignment.userId,
      buildingId: assignment.buildingId,
      roleDefinitionId: assignment.roleDefinitionId,
      reason: input.demotionReason,
      notes: input.demotionNotes
    });
  }

  const overrideNote = normalizeOptionalText(input.overrideNote) ?? null;
  const [updatedAssignment, promotedWaitingEntry] = await Promise.all([
    tx.assignment.update({
      where: {
        id: assignment.id
      },
      data: {
        userId: replacementUser.id,
        assignedMethod: AssignmentMethod.MANUAL,
        isManualOverride: input.manualOverride ?? false,
        overrideNote
      },
      select: swapAssignmentSelect
    }),
    tx.waitingList.update({
      where: {
        id: waitingEntry.id
      },
      data: {
        status: WaitingListStatus.PROMOTED,
        promotedAt: new Date(),
        removedAt: null,
        buildingId: assignment.buildingId,
        roleDefinitionId: assignment.roleDefinitionId
      },
      select: swapWaitingListSelect
    })
  ]);

  await rerankWaitingEntriesInTransaction(tx, session.id);

  const refreshedPromoted = await assertSwapWaitingListExists(tx, promotedWaitingEntry.id);
  const refreshedDemoted = demotedWaitingEntry
    ? await assertSwapWaitingListExists(tx, demotedWaitingEntry.id)
    : undefined;

  return {
    kind: input.kind,
    sessionId: session.id,
    changedAssignmentIds: [updatedAssignment.id],
    assignments: [toAssignmentSnapshot(updatedAssignment)],
    promotedWaitingListEntry: toWaitingListSnapshot(refreshedPromoted),
    ...(refreshedDemoted
      ? {
          demotedWaitingListEntry: toWaitingListSnapshot(refreshedDemoted)
        }
      : {})
  };
}

async function runManualReplacement(
  tx: Prisma.TransactionClient,
  input: Extract<ExecuteSwapContract, { kind: "MANUAL_REPLACEMENT" }>
): Promise<SwapExecutionResultContract> {
  const assignment = await assertSwapAssignmentExists(tx, input.assignmentId);

  assertSessionMatches(input.sessionId, assignment.sessionId);
  assertAssignmentSwappable(assignment);
  const session = await getAssignableSessionInTransaction(tx, input.sessionId);

  if (assignment.userId === input.replacementUserId) {
    throw new SwapServiceError(
      ERROR_CODES.swapNoOp,
      409,
      "Replacement user is already assigned to this placement.",
      {
        assignmentId: assignment.id,
        userId: assignment.userId
      }
    );
  }

  const replacementUser = await assertReplacementUserExists(tx, input.replacementUserId);
  assertReplacementUserNotBlocked(replacementUser);
  await assertNoAssignmentDuplicateForSessionUser(tx, {
    sessionId: session.id,
    userId: replacementUser.id,
    ignoredAssignmentId: assignment.id
  });
  await assertNoOverlapForReplacement(tx, session, replacementUser.id);

  let demotedWaitingEntry: SwapWaitingListRecord | undefined;

  if (input.demoteCurrentAssignee ?? true) {
    demotedWaitingEntry = await maybeCreateDemotedWaitingEntry(tx, {
      session,
      ignoredAssignmentId: assignment.id,
      userId: assignment.userId,
      buildingId: assignment.buildingId,
      roleDefinitionId: assignment.roleDefinitionId,
      reason: input.demotionReason,
      notes: input.demotionNotes
    });
  }

  const updatedAssignment = await tx.assignment.update({
    where: {
      id: assignment.id
    },
    data: {
      userId: replacementUser.id,
      assignedMethod: AssignmentMethod.MANUAL,
      isManualOverride: input.manualOverride ?? false,
      overrideNote: normalizeOptionalText(input.overrideNote) ?? null
    },
    select: swapAssignmentSelect
  });

  if (demotedWaitingEntry) {
    await rerankWaitingEntriesInTransaction(tx, session.id);
  }

  const refreshedDemoted = demotedWaitingEntry
    ? await assertSwapWaitingListExists(tx, demotedWaitingEntry.id)
    : undefined;

  return {
    kind: input.kind,
    sessionId: session.id,
    changedAssignmentIds: [updatedAssignment.id],
    assignments: [toAssignmentSnapshot(updatedAssignment)],
    ...(refreshedDemoted
      ? {
          demotedWaitingListEntry: toWaitingListSnapshot(refreshedDemoted)
        }
      : {})
  };
}

function normalizeMutationError(error: unknown): never {
  if (error instanceof SwapServiceError) {
    throw error;
  }

  if (error instanceof AssignmentsServiceError) {
    throw new SwapServiceError(
      error.code,
      error.status,
      error.message,
      error.details
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new SwapServiceError(
      ERROR_CODES.duplicateAssignment,
      409,
      "Swap operation violated a unique assignment or waiting-list constraint.",
      error.meta ?? null
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new SwapServiceError(
      ERROR_CODES.notFound,
      404,
      "Swap record was not found."
    );
  }

  throw error;
}

export async function executeSwap(
  input: ExecuteSwapInput,
  actorAppUserId: string
): Promise<SwapExecutionResultContract> {
  const contractInput: ExecuteSwapContract = input;

  try {
    return await db.$transaction(
      async (tx) => {
        const result =
          contractInput.kind === "DIRECT_ASSIGNMENT_SWAP"
            ? await runDirectAssignmentSwap(tx, contractInput)
            : contractInput.kind === "WAITING_LIST_REPLACEMENT"
              ? await runWaitingListReplacement(tx, contractInput)
              : await runManualReplacement(tx, contractInput);

        await logActivity({
          client: tx,
          userId: actorAppUserId,
          action: "swap",
          entityType: "assignment",
          entityId: result.changedAssignmentIds[0] ?? result.sessionId,
          description: `Executed ${result.kind.toLowerCase()} for session ${result.sessionId}.`,
          metadata: {
            kind: result.kind,
            sessionId: result.sessionId,
            changedAssignmentIds: result.changedAssignmentIds,
            promotedWaitingListEntryId: result.promotedWaitingListEntry?.id ?? null,
            demotedWaitingListEntryId: result.demotedWaitingListEntry?.id ?? null
          },
          afterPayload: result
        });

        return result;
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
