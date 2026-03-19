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

export const assignmentMutableSessionStatuses: SessionStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "LOCKED"
];
