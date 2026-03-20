import type {
  AssignmentMethod,
  AssignmentStatus,
  AttendanceStatus,
  SessionStatus
} from "@prisma/client";

export type MetricsFiltersContract = {
  sessionId?: string;
  cycleId?: string;
  locationId?: string;
  locale?: "en" | "ar";
};

export type MetricsBreakdownItemContract<T extends string> = {
  key: T;
  count: number;
  labelEn: string;
  labelAr: string;
};

export type SessionsMetricsContract = {
  metricType: "sessions";
  generatedAt: Date;
  filters: MetricsFiltersContract;
  totals: {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    cancelledSessions: number;
  };
  statusBreakdown: MetricsBreakdownItemContract<SessionStatus>[];
};

export type AssignmentsMetricsContract = {
  metricType: "assignments";
  generatedAt: Date;
  filters: MetricsFiltersContract;
  totals: {
    totalAssignments: number;
    uniqueAssignedUsers: number;
    manualAssignments: number;
    autoAssignments: number;
    cancelledAssignments: number;
    completedAssignments: number;
  };
  statusBreakdown: MetricsBreakdownItemContract<AssignmentStatus>[];
  methodBreakdown: MetricsBreakdownItemContract<AssignmentMethod>[];
};

export type AttendanceMetricsContract = {
  metricType: "attendance";
  generatedAt: Date;
  filters: MetricsFiltersContract;
  totals: {
    totalAssignments: number;
    attendanceRecords: number;
    pendingCount: number;
    confirmedCount: number;
    absentCount: number;
    declinedCount: number;
    attendanceRatio: number;
  };
  statusBreakdown: MetricsBreakdownItemContract<AttendanceStatus>[];
};
