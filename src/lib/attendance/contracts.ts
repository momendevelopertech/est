import type {
  AssignmentStatus,
  AttendanceStatus,
  SessionStatus
} from "@prisma/client";

export type AttendanceListContract = {
  page?: number;
  pageSize?: number;
  search?: string;
  sessionId?: string;
  assignmentId?: string;
  userId?: string;
  status?: AttendanceStatus;
};

export type UpdateAttendanceContract = {
  assignmentId: string;
  status: AttendanceStatus;
  notes?: string;
  checkedInAt?: Date;
  replacementWaitingListId?: string;
};

export type AttendanceReplacementSuggestionsContract = {
  assignmentId: string;
};

export type AttendanceSessionContextContract = {
  sessionId: string;
  cycleId: string;
  status: SessionStatus;
  derivedStatus: SessionStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
};

export type AttendanceRecordContract = {
  assignmentId: string;
  assignmentStatus: AssignmentStatus;
  attendanceId: string | null;
  attendanceStatus: AttendanceStatus;
  checkedInAt: Date | null;
  notes: string | null;
  updatedByAppUserId: string | null;
  updatedAt: Date;
};
