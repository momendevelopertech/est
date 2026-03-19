import type {
  AssignmentMethod,
  AssignmentStatus,
  ExamType,
  OperationalRoleScope,
  SessionStatus
} from "@prisma/client";

export type AssignmentPlacementContract = {
  buildingId: string;
  floorId?: string | null;
  roomId?: string | null;
};

export type AssignmentCreateContract = AssignmentPlacementContract & {
  sessionId: string;
  userId: string;
  roleDefinitionId: string;
  assignedMethod?: AssignmentMethod;
  overrideNote?: string | null;
};

export type AssignmentListContract = {
  page?: number;
  pageSize?: number;
  search?: string;
  sessionId?: string;
  userId?: string;
  buildingId?: string;
  roleDefinitionId?: string;
  status?: AssignmentStatus;
  assignedMethod?: AssignmentMethod;
};

export type AssignmentSessionContextContract = {
  sessionId: string;
  cycleId: string;
  examType: ExamType;
  sessionStatus: SessionStatus;
  buildingIds: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export type AssignmentRoleContextContract = {
  roleDefinitionId: string;
  scope: OperationalRoleScope;
  manualOnly: boolean;
};

export type AssignmentEngineSnapshotContract = {
  session: AssignmentSessionContextContract;
  role: AssignmentRoleContextContract;
  existingAssignmentsCount: number;
};

export type AutoAssignmentSlotContract = AssignmentPlacementContract & {
  roleDefinitionId: string;
};

export type AutoAssignmentInputContract = {
  sessionId: string;
  roleDefinitionIds?: string[];
  candidateUserIds?: string[];
  dryRun?: boolean;
};

export type AutoAssignmentPlannedItemContract = AutoAssignmentSlotContract & {
  userId: string;
};

export type AutoAssignmentResultContract = {
  sessionId: string;
  dryRun: boolean;
  settings: {
    minRatingThreshold: number;
  };
  roleCount: number;
  totalSlots: number;
  existingAssignmentsCount: number;
  plannedAssignmentsCount: number;
  createdAssignmentsCount: number;
  unfilledSlotsCount: number;
  skippedManualRoleCount: number;
  skippedExistingSlotCount: number;
  skippedUserPoolCount: number;
  plannedAssignments: AutoAssignmentPlannedItemContract[];
  unfilledSlots: AutoAssignmentSlotContract[];
  createdAssignmentIds: string[];
};

export const assignmentMutableSessionStatuses: SessionStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "LOCKED"
];
