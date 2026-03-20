import { randomUUID } from "node:crypto";

import {
  AssignmentMethod,
  AssignmentStatus,
  AttendanceStatus,
  Prisma,
  SessionStatus
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";

import type {
  AssignmentsMetricsContract,
  AttendanceMetricsContract,
  MetricsBreakdownItemContract,
  MetricsFiltersContract,
  SessionsMetricsContract
} from "./contracts";
import type { MetricsQuery } from "./validation";

const orderedSessionStatuses: SessionStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "LOCKED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
];

const orderedAssignmentStatuses: AssignmentStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "LOCKED",
  "COMPLETED",
  "CANCELLED"
];

const orderedAssignmentMethods: AssignmentMethod[] = ["AUTO", "MANUAL"];
const orderedAttendanceStatuses: AttendanceStatus[] = [
  "PENDING",
  "CONFIRMED",
  "ABSENT",
  "DECLINED"
];

const sessionStatusLabels: Record<SessionStatus, { en: string; ar: string }> = {
  DRAFT: { en: "Draft", ar: "مسودة" },
  SCHEDULED: { en: "Scheduled", ar: "مجدولة" },
  LOCKED: { en: "Locked", ar: "مقفلة" },
  IN_PROGRESS: { en: "In Progress", ar: "قيد التنفيذ" },
  COMPLETED: { en: "Completed", ar: "مكتملة" },
  CANCELLED: { en: "Cancelled", ar: "ملغاة" }
};

const assignmentStatusLabels: Record<
  AssignmentStatus,
  { en: string; ar: string }
> = {
  DRAFT: { en: "Draft", ar: "مسودة" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكدة" },
  LOCKED: { en: "Locked", ar: "مقفلة" },
  COMPLETED: { en: "Completed", ar: "مكتملة" },
  CANCELLED: { en: "Cancelled", ar: "ملغاة" }
};

const assignmentMethodLabels: Record<
  AssignmentMethod,
  { en: string; ar: string }
> = {
  AUTO: { en: "Auto", ar: "آلي" },
  MANUAL: { en: "Manual", ar: "يدوي" }
};

const attendanceStatusLabels: Record<
  AttendanceStatus,
  { en: string; ar: string }
> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  CONFIRMED: { en: "Confirmed", ar: "تم التأكيد" },
  ABSENT: { en: "Absent", ar: "غائب" },
  DECLINED: { en: "Declined", ar: "اعتذار" }
};

const filterSessionSelect = {
  id: true,
  cycleId: true,
  buildings: {
    where: {
      isActive: true
    },
    select: {
      buildingId: true
    }
  }
} satisfies Prisma.SessionSelect;

type FilterSessionRecord = Prisma.SessionGetPayload<{
  select: typeof filterSessionSelect;
}>;

type MetricsInput = MetricsQuery & {
  actorAppUserId: string;
  skipActivityLog?: boolean;
};

export class MetricsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "MetricsServiceError";
  }
}

function normalizeFilters(input: MetricsQuery): MetricsFiltersContract {
  return {
    sessionId: input.sessionId,
    cycleId: input.cycleId,
    locationId: input.locationId,
    locale: input.locale === "ar" ? "ar" : "en"
  };
}

function buildSessionWhere(filters: MetricsFiltersContract): Prisma.SessionWhereInput {
  return {
    ...(filters.sessionId
      ? {
          id: filters.sessionId
        }
      : {}),
    ...(filters.cycleId
      ? {
          cycleId: filters.cycleId
        }
      : {}),
    ...(filters.locationId
      ? {
          buildings: {
            some: {
              buildingId: filters.locationId,
              isActive: true
            }
          }
        }
      : {})
  };
}

function buildAssignmentWhere(
  filters: MetricsFiltersContract
): Prisma.AssignmentWhereInput {
  return {
    ...(filters.sessionId
      ? {
          sessionId: filters.sessionId
        }
      : {}),
    ...(filters.cycleId
      ? {
          session: {
            cycleId: filters.cycleId
          }
        }
      : {}),
    ...(filters.locationId
      ? {
          buildingId: filters.locationId
        }
      : {})
  };
}

function toBreakdown<T extends string>(
  keys: readonly T[],
  countsByKey: Map<T, number>,
  labels: Record<T, { en: string; ar: string }>
): MetricsBreakdownItemContract<T>[] {
  return keys.map((key) => ({
    key,
    count: countsByKey.get(key) ?? 0,
    labelEn: labels[key].en,
    labelAr: labels[key].ar
  }));
}

async function assertFiltersExist(filters: MetricsFiltersContract) {
  let session: FilterSessionRecord | null = null;

  if (filters.sessionId) {
    session = await db.session.findUnique({
      where: {
        id: filters.sessionId
      },
      select: filterSessionSelect
    });

    if (!session) {
      throw new MetricsServiceError(
        ERROR_CODES.sessionNotFound,
        404,
        "Session not found.",
        {
          sessionId: filters.sessionId
        }
      );
    }
  }

  if (filters.cycleId) {
    const cycle = await db.cycle.findUnique({
      where: {
        id: filters.cycleId
      },
      select: {
        id: true
      }
    });

    if (!cycle) {
      throw new MetricsServiceError(
        ERROR_CODES.cycleNotFound,
        404,
        "Cycle not found.",
        {
          cycleId: filters.cycleId
        }
      );
    }
  }

  if (filters.locationId) {
    const building = await db.building.findUnique({
      where: {
        id: filters.locationId
      },
      select: {
        id: true
      }
    });

    if (!building) {
      throw new MetricsServiceError(
        ERROR_CODES.buildingNotFound,
        404,
        "Location not found.",
        {
          locationId: filters.locationId
        }
      );
    }
  }

  if (session && filters.cycleId && session.cycleId !== filters.cycleId) {
    throw new MetricsServiceError(
      ERROR_CODES.metricsFilterMismatch,
      409,
      "Session does not belong to the selected cycle.",
      {
        sessionId: session.id,
        cycleId: filters.cycleId,
        sessionCycleId: session.cycleId
      }
    );
  }

  if (session && filters.locationId) {
    const hasLocation = session.buildings.some(
      (link) => link.buildingId === filters.locationId
    );

    if (!hasLocation) {
      throw new MetricsServiceError(
        ERROR_CODES.metricsFilterMismatch,
        409,
        "Session is not linked to the selected location.",
        {
          sessionId: session.id,
          locationId: filters.locationId
        }
      );
    }
  }
}

async function logMetricsAccess(input: {
  actorAppUserId: string;
  metricType: "sessions" | "assignments" | "attendance";
  filters: MetricsFiltersContract;
  totals: Record<string, number>;
}) {
  await db.$transaction(
    async (tx) => {
      await logActivity({
        client: tx,
        userId: input.actorAppUserId,
        action: "metrics_view",
        entityType: "metrics",
        entityId: randomUUID(),
        description: `Viewed ${input.metricType} metrics.`,
        metadata: {
          metricType: input.metricType,
          filters: input.filters,
          totals: input.totals
        }
      });
    },
    {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    }
  );
}

export async function getSessionsMetrics(
  input: MetricsInput
): Promise<SessionsMetricsContract> {
  const filters = normalizeFilters(input);
  await assertFiltersExist(filters);

  const where = buildSessionWhere(filters);
  const [totalSessions, statusGroups] = await Promise.all([
    db.session.count({
      where
    }),
    db.session.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true
      }
    })
  ]);

  const statusCounts = new Map<SessionStatus, number>();
  for (const group of statusGroups) {
    statusCounts.set(group.status, group._count._all);
  }

  const completedSessions = statusCounts.get(SessionStatus.COMPLETED) ?? 0;
  const cancelledSessions = statusCounts.get(SessionStatus.CANCELLED) ?? 0;
  const activeSessions =
    (statusCounts.get(SessionStatus.SCHEDULED) ?? 0) +
    (statusCounts.get(SessionStatus.LOCKED) ?? 0) +
    (statusCounts.get(SessionStatus.IN_PROGRESS) ?? 0);

  const result: SessionsMetricsContract = {
    metricType: "sessions",
    generatedAt: new Date(),
    filters,
    totals: {
      totalSessions,
      activeSessions,
      completedSessions,
      cancelledSessions
    },
    statusBreakdown: toBreakdown(
      orderedSessionStatuses,
      statusCounts,
      sessionStatusLabels
    )
  };

  if (!input.skipActivityLog) {
    await logMetricsAccess({
      actorAppUserId: input.actorAppUserId,
      metricType: "sessions",
      filters,
      totals: result.totals
    });
  }

  return result;
}

export async function getAssignmentsMetrics(
  input: MetricsInput
): Promise<AssignmentsMetricsContract> {
  const filters = normalizeFilters(input);
  await assertFiltersExist(filters);

  const where = buildAssignmentWhere(filters);
  const [totalAssignments, statusGroups, methodGroups, userGroups] = await Promise.all([
    db.assignment.count({
      where
    }),
    db.assignment.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true
      }
    }),
    db.assignment.groupBy({
      by: ["assignedMethod"],
      where,
      _count: {
        _all: true
      }
    }),
    db.assignment.groupBy({
      by: ["userId"],
      where
    })
  ]);

  const statusCounts = new Map<AssignmentStatus, number>();
  for (const group of statusGroups) {
    statusCounts.set(group.status, group._count._all);
  }

  const methodCounts = new Map<AssignmentMethod, number>();
  for (const group of methodGroups) {
    methodCounts.set(group.assignedMethod, group._count._all);
  }

  const result: AssignmentsMetricsContract = {
    metricType: "assignments",
    generatedAt: new Date(),
    filters,
    totals: {
      totalAssignments,
      uniqueAssignedUsers: userGroups.length,
      manualAssignments: methodCounts.get(AssignmentMethod.MANUAL) ?? 0,
      autoAssignments: methodCounts.get(AssignmentMethod.AUTO) ?? 0,
      cancelledAssignments: statusCounts.get(AssignmentStatus.CANCELLED) ?? 0,
      completedAssignments: statusCounts.get(AssignmentStatus.COMPLETED) ?? 0
    },
    statusBreakdown: toBreakdown(
      orderedAssignmentStatuses,
      statusCounts,
      assignmentStatusLabels
    ),
    methodBreakdown: toBreakdown(
      orderedAssignmentMethods,
      methodCounts,
      assignmentMethodLabels
    )
  };

  if (!input.skipActivityLog) {
    await logMetricsAccess({
      actorAppUserId: input.actorAppUserId,
      metricType: "assignments",
      filters,
      totals: result.totals
    });
  }

  return result;
}

export async function getAttendanceMetrics(
  input: MetricsInput
): Promise<AttendanceMetricsContract> {
  const filters = normalizeFilters(input);
  await assertFiltersExist(filters);

  const assignmentWhere = buildAssignmentWhere(filters);
  const attendanceWhere = {
    assignment: assignmentWhere
  } satisfies Prisma.AttendanceWhereInput;

  const [totalAssignments, attendanceRecords, statusGroups] = await Promise.all([
    db.assignment.count({
      where: assignmentWhere
    }),
    db.attendance.count({
      where: attendanceWhere
    }),
    db.attendance.groupBy({
      by: ["status"],
      where: attendanceWhere,
      _count: {
        _all: true
      }
    })
  ]);

  const statusCounts = new Map<AttendanceStatus, number>();
  for (const group of statusGroups) {
    statusCounts.set(group.status, group._count._all);
  }

  const confirmedCount = statusCounts.get(AttendanceStatus.CONFIRMED) ?? 0;
  const absentCount = statusCounts.get(AttendanceStatus.ABSENT) ?? 0;
  const declinedCount = statusCounts.get(AttendanceStatus.DECLINED) ?? 0;
  const pendingRows = statusCounts.get(AttendanceStatus.PENDING) ?? 0;
  const pendingMissing = Math.max(totalAssignments - attendanceRecords, 0);
  const pendingCount = pendingRows + pendingMissing;
  const attendanceRatio =
    totalAssignments === 0
      ? 0
      : Number((confirmedCount / totalAssignments).toFixed(4));

  statusCounts.set(AttendanceStatus.PENDING, pendingCount);

  const result: AttendanceMetricsContract = {
    metricType: "attendance",
    generatedAt: new Date(),
    filters,
    totals: {
      totalAssignments,
      attendanceRecords,
      pendingCount,
      confirmedCount,
      absentCount,
      declinedCount,
      attendanceRatio
    },
    statusBreakdown: toBreakdown(
      orderedAttendanceStatuses,
      statusCounts,
      attendanceStatusLabels
    )
  };

  if (!input.skipActivityLog) {
    await logMetricsAccess({
      actorAppUserId: input.actorAppUserId,
      metricType: "attendance",
      filters,
      totals: result.totals
    });
  }

  return result;
}
