import type {
  BlockRecordStatus,
  BlockSource,
  BlockStatus,
  BlockType
} from "@prisma/client";

export type BlockSummaryContract = {
  id: string;
  userId: string;
  type: BlockType;
  status: BlockRecordStatus;
  source: BlockSource;
  startsAt: Date;
  endsAt: Date | null;
  reason: string | null;
  notes: string | null;
  liftReason: string | null;
  liftedAt: Date | null;
  createdByAppUserId: string | null;
  liftedByAppUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BlockedUserSummaryContract = {
  id: string;
  name: string;
  nameEn: string | null;
  isActive: boolean;
  blockStatus: BlockStatus;
  blockEndsAt: Date | null;
};

export type CreateBlockContract = {
  userId: string;
  type: BlockType;
  startsAt?: Date;
  endsAt?: Date;
  source?: BlockSource;
  reason?: string;
  notes?: string;
};

export type CreateBlockResultContract = {
  mode: "blocked";
  user: BlockedUserSummaryContract;
  block: BlockSummaryContract;
};

export type UnblockUserContract = {
  userId: string;
  liftReason?: string;
  notes?: string;
};

export type UnblockUserResultContract = {
  mode: "unblocked";
  user: BlockedUserSummaryContract;
  liftedBlockCount: number;
  liftedBlockIds: string[];
};
