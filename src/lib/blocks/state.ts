import { BlockStatus, Prisma } from "@prisma/client";

export type UserBlockState = {
  blockStatus: BlockStatus;
  blockEndsAt: Date | null;
};

export function isUserBlockedState(user: UserBlockState, now = new Date()) {
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

export function buildUnblockedUserWhere(now = new Date()): Prisma.UserWhereInput {
  return {
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
  };
}

export function resolveUserBlockStatusFromType(type: "TEMPORARY" | "PERMANENT") {
  return type === "PERMANENT" ? BlockStatus.PERMANENT : BlockStatus.TEMPORARY;
}
