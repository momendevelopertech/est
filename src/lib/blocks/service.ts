import {
  BlockRecordStatus,
  BlockStatus,
  BlockType,
  Prisma,
  type PrismaClient
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";

import { resolveUserBlockStatusFromType } from "./state";
import type {
  CreateBlockContract,
  CreateBlockResultContract,
  UnblockUserContract,
  UnblockUserResultContract
} from "./contracts";
import type { CreateBlockInput, UnblockUserInput } from "./validation";

type ActivityClient = Prisma.TransactionClient | PrismaClient;

const blockedUserSelect = {
  id: true,
  name: true,
  nameEn: true,
  isActive: true,
  blockStatus: true,
  blockEndsAt: true
} satisfies Prisma.UserSelect;

const blockSelect = {
  id: true,
  userId: true,
  type: true,
  status: true,
  source: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  notes: true,
  liftReason: true,
  liftedAt: true,
  createdByAppUserId: true,
  liftedByAppUserId: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.BlockSelect;

type BlockRecord = Prisma.BlockGetPayload<{
  select: typeof blockSelect;
}>;

export class BlockServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "BlockServiceError";
  }
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function isActiveBlockingRecord(block: Pick<BlockRecord, "type" | "endsAt">, now = new Date()) {
  if (block.type === BlockType.PERMANENT) {
    return true;
  }

  if (!block.endsAt) {
    return true;
  }

  return block.endsAt.getTime() > now.getTime();
}

async function assertUserExists(client: ActivityClient, userId: string) {
  const user = await client.user.findUnique({
    where: {
      id: userId
    },
    select: blockedUserSelect
  });

  if (!user) {
    throw new BlockServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found."
    );
  }

  return user;
}

async function expireElapsedTemporaryBlocks(
  tx: Prisma.TransactionClient,
  userId: string,
  now = new Date()
) {
  const staleActiveTemporaryBlocks = await tx.block.findMany({
    where: {
      userId,
      status: BlockRecordStatus.ACTIVE,
      type: BlockType.TEMPORARY,
      endsAt: {
        lte: now
      }
    },
    select: {
      id: true
    }
  });
  const staleIds = staleActiveTemporaryBlocks.map((block) => block.id);

  if (staleIds.length === 0) {
    return [];
  }

  await tx.block.updateMany({
    where: {
      id: {
        in: staleIds
      }
    },
    data: {
      status: BlockRecordStatus.EXPIRED
    }
  });

  return staleIds;
}

async function findActiveBlocks(
  tx: Prisma.TransactionClient,
  userId: string,
  now = new Date()
) {
  const activeBlocks = await tx.block.findMany({
    where: {
      userId,
      status: BlockRecordStatus.ACTIVE
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: blockSelect
  });

  return activeBlocks.filter((block) => isActiveBlockingRecord(block, now));
}

function normalizeMutationError(error: unknown): never {
  if (error instanceof BlockServiceError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new BlockServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found."
    );
  }

  throw error;
}

export async function createBlock(input: CreateBlockInput, actorAppUserId: string) {
  const contractInput: CreateBlockContract = input;

  try {
    return await db.$transaction(
      async (tx): Promise<CreateBlockResultContract> => {
        const now = new Date();
        const userBefore = await assertUserExists(tx, contractInput.userId);
        const startsAt = contractInput.startsAt ?? now;
        const endsAt =
          contractInput.type === BlockType.TEMPORARY
            ? contractInput.endsAt ?? null
            : null;

        if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
          throw new BlockServiceError(
            ERROR_CODES.invalidDateRange,
            400,
            "Temporary block end date must be after block start date.",
            {
              startsAt,
              endsAt
            }
          );
        }

        await expireElapsedTemporaryBlocks(tx, userBefore.id, now);

        const existingActiveBlocks = await findActiveBlocks(tx, userBefore.id, now);

        if (existingActiveBlocks.length > 0) {
          throw new BlockServiceError(
            ERROR_CODES.duplicateActiveBlock,
            409,
            "User already has an active block.",
            {
              userId: userBefore.id,
              activeBlockIds: existingActiveBlocks.map((block) => block.id)
            }
          );
        }

        const updatedUser = await tx.user.update({
          where: {
            id: userBefore.id
          },
          data: {
            blockStatus: resolveUserBlockStatusFromType(contractInput.type),
            blockEndsAt: endsAt
          },
          select: blockedUserSelect
        });

        const createdBlock = await tx.block.create({
          data: {
            userId: userBefore.id,
            type: contractInput.type,
            status: BlockRecordStatus.ACTIVE,
            source: contractInput.source,
            startsAt,
            endsAt,
            reason: normalizeOptionalText(contractInput.reason) ?? null,
            notes: normalizeOptionalText(contractInput.notes) ?? null,
            createdByAppUserId: actorAppUserId
          },
          select: blockSelect
        });

        await logActivity({
          client: tx,
          userId: actorAppUserId,
          action: "block_create",
          entityType: "block",
          entityId: createdBlock.id,
          description: `Blocked user ${updatedUser.name}.`,
          metadata: {
            blockId: createdBlock.id,
            userId: updatedUser.id,
            type: createdBlock.type,
            source: createdBlock.source,
            startsAt: createdBlock.startsAt,
            endsAt: createdBlock.endsAt
          },
          beforePayload: userBefore,
          afterPayload: {
            user: updatedUser,
            block: createdBlock
          }
        });

        return {
          mode: "blocked",
          user: updatedUser,
          block: createdBlock
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function unblockUser(input: UnblockUserInput, actorAppUserId: string) {
  const contractInput: UnblockUserContract = input;

  try {
    return await db.$transaction(
      async (tx): Promise<UnblockUserResultContract> => {
        const now = new Date();
        const userBefore = await assertUserExists(tx, contractInput.userId);

        await expireElapsedTemporaryBlocks(tx, userBefore.id, now);

        const activeBlocks = await findActiveBlocks(tx, userBefore.id, now);
        const hasStoredBlockState =
          userBefore.blockStatus !== BlockStatus.CLEAR ||
          userBefore.blockEndsAt !== null;

        if (activeBlocks.length === 0 && !hasStoredBlockState) {
          throw new BlockServiceError(
            ERROR_CODES.blockNotActive,
            409,
            "User does not have an active block.",
            {
              userId: userBefore.id
            }
          );
        }

        const activeBlockIds = activeBlocks.map((block) => block.id);

        if (activeBlockIds.length > 0) {
          await tx.block.updateMany({
            where: {
              id: {
                in: activeBlockIds
              }
            },
            data: {
              status: BlockRecordStatus.LIFTED,
              liftedAt: now,
              liftReason:
                normalizeOptionalText(contractInput.liftReason) ??
                normalizeOptionalText(contractInput.notes) ??
                "manual_unblock",
              liftedByAppUserId: actorAppUserId
            }
          });
        }

        const updatedUser = await tx.user.update({
          where: {
            id: userBefore.id
          },
          data: {
            blockStatus: BlockStatus.CLEAR,
            blockEndsAt: null
          },
          select: blockedUserSelect
        });

        await logActivity({
          client: tx,
          userId: actorAppUserId,
          action: "block_unblock",
          entityType: "block",
          entityId: activeBlockIds[0] ?? updatedUser.id,
          description: `Unblocked user ${updatedUser.name}.`,
          metadata: {
            userId: updatedUser.id,
            liftedBlockCount: activeBlockIds.length,
            liftedBlockIds: activeBlockIds
          },
          beforePayload: {
            user: userBefore,
            activeBlockIds
          },
          afterPayload: updatedUser
        });

        return {
          mode: "unblocked",
          user: updatedUser,
          liftedBlockCount: activeBlockIds.length,
          liftedBlockIds: activeBlockIds
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch (error) {
    normalizeMutationError(error);
  }
}
