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

export type LateImportRerankInputContract = {
  sessionId: string;
  roleDefinitionIds?: string[];
  candidateUserIds?: string[];
  dryRun?: boolean;
};

export type LateImportRerankResultContract = {
  sessionId: string;
  dryRun: boolean;
  resetAssignmentsCount: number;
  resettableAutoDraftAssignmentIds: string[];
  preservedManualAssignmentCount: number;
  preservedNonDraftAutoAssignmentCount: number;
  newlyAvailableCandidateUserIds: string[];
  autoAssignResult: AutoAssignmentResultContract;
};

export const sessionPreLockIssueCodes = [
  "duplicate_assignment_in_session",
  "room_capacity_min_not_satisfied",
  "missing_floor_senior_coverage",
  "missing_floor_roaming_coverage",
  "missing_building_head_coverage",
  "blocked_user_assigned",
  "manual_only_role_not_manual",
  "assn_room_not_manual"
] as const;

export type SessionPreLockIssueCode = (typeof sessionPreLockIssueCodes)[number];

export type SessionPreLockValidationIssueContract = {
  code: SessionPreLockIssueCode;
  message: string;
  assignmentId?: string;
  userId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  expected?: number;
  actual?: number;
  assignmentIds?: string[];
};

export type SessionPreLockValidationResultContract = {
  sessionId: string;
  isReady: boolean;
  checkedAt: Date;
  settings: {
    requiredBuildingHeadCountPerBuilding: number;
    requiredFloorSeniorCountPerFloor: number;
    requiredFloorRoamingCountPerFloor: number;
  };
  totals: {
    buildingCount: number;
    floorCount: number;
    roomCount: number;
    activeAssignmentsCount: number;
  };
  issues: SessionPreLockValidationIssueContract[];
};

export const assignmentMutableSessionStatuses: SessionStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "LOCKED"
];
