import type {
  AssignmentMethod,
  AssignmentStatus,
  WaitingListStatus
} from "@prisma/client";

export const swapOperationKinds = [
  "DIRECT_ASSIGNMENT_SWAP",
  "WAITING_LIST_REPLACEMENT",
  "MANUAL_REPLACEMENT"
] as const;

export type SwapOperationKind = (typeof swapOperationKinds)[number];

type SwapBaseContract = {
  sessionId: string;
  manualOverride?: boolean;
  overrideNote?: string;
};

export type DirectAssignmentSwapContract = SwapBaseContract & {
  kind: "DIRECT_ASSIGNMENT_SWAP";
  primaryAssignmentId: string;
  secondaryAssignmentId: string;
};

export type WaitingListReplacementSwapContract = SwapBaseContract & {
  kind: "WAITING_LIST_REPLACEMENT";
  assignmentId: string;
  waitingListId: string;
  demoteCurrentAssignee?: boolean;
  demotionReason?: string;
  demotionNotes?: string;
};

export type ManualReplacementSwapContract = SwapBaseContract & {
  kind: "MANUAL_REPLACEMENT";
  assignmentId: string;
  replacementUserId: string;
  demoteCurrentAssignee?: boolean;
  demotionReason?: string;
  demotionNotes?: string;
};

export type ExecuteSwapContract =
  | DirectAssignmentSwapContract
  | WaitingListReplacementSwapContract
  | ManualReplacementSwapContract;

export type SwapAssignmentSnapshotContract = {
  id: string;
  sessionId: string;
  userId: string;
  buildingId: string;
  floorId: string | null;
  roomId: string | null;
  roleDefinitionId: string;
  status: AssignmentStatus;
  assignedMethod: AssignmentMethod;
  isManualOverride: boolean;
  overrideNote: string | null;
};

export type SwapWaitingListSnapshotContract = {
  id: string;
  sessionId: string;
  userId: string;
  status: WaitingListStatus;
  priority: number;
  buildingId: string | null;
  roleDefinitionId: string | null;
  entrySource: string | null;
};

export type SwapExecutionResultContract = {
  kind: SwapOperationKind;
  sessionId: string;
  changedAssignmentIds: string[];
  assignments: SwapAssignmentSnapshotContract[];
  promotedWaitingListEntry?: SwapWaitingListSnapshotContract;
  demotedWaitingListEntry?: SwapWaitingListSnapshotContract;
};
