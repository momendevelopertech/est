import type {
  SessionStatus,
  WaitingListStatus
} from "@prisma/client";

export type WaitingListCreateContract = {
  sessionId: string;
  userId: string;
  buildingId?: string;
  roleDefinitionId?: string;
  entrySource?: string;
  reason?: string;
  notes?: string;
};

export type WaitingListPromoteContract = {
  buildingId?: string;
  roleDefinitionId?: string;
  floorId?: string;
  roomId?: string;
  overrideNote?: string;
};

export type WaitingListRemoveContract = {
  reason?: string;
  notes?: string;
};

export type WaitingListListContract = {
  page?: number;
  pageSize?: number;
  search?: string;
  sessionId?: string;
  cycleId?: string;
  userId?: string;
  buildingId?: string;
  status?: WaitingListStatus;
};

export type WaitingListSessionContextContract = {
  sessionId: string;
  cycleId: string;
  status: SessionStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
};

