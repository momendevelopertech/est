import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import {
  getAssignmentsMetrics,
  getAttendanceMetrics,
  getSessionsMetrics,
  MetricsServiceError
} from "@/lib/metrics/service";

import type {
  ReportBreakdownItemContract,
  ReportMetricCardContract,
  ReportSummaryContract
} from "./contracts";
import type { ReportQuery } from "./validation";

const evaluationScoreBuckets = [
  {
    key: "low",
    labelEn: "Low (1.00-2.99)",
    labelAr: "منخفض (1.00-2.99)",
    check: (score: number) => score < 3
  },
  {
    key: "medium",
    labelEn: "Medium (3.00-3.99)",
    labelAr: "متوسط (3.00-3.99)",
    check: (score: number) => score >= 3 && score < 4
  },
  {
    key: "high",
    labelEn: "High (4.00-5.00)",
    labelAr: "مرتفع (4.00-5.00)",
    check: (score: number) => score >= 4
  }
] as const;

type ReportInput = ReportQuery & {
  actorAppUserId: string;
};

type EvaluationSummaryRow = {
  score: string | Prisma.Decimal | null;
  subjectUserId: string;
  sessionId: string;
};

export class ReportsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ReportsServiceError";
  }
}

function toNumber(
  value: Prisma.Decimal | string | number | null | undefined
) {
  if (!value) {
    return 0;
  }

  return Number(value.toString());
}

function normalizeFilters(input: ReportQuery) {
  return {
    sessionId: input.sessionId,
    cycleId: input.cycleId,
    locationId: input.locationId,
    locale: input.locale === "ar" ? "ar" : "en"
  } as const;
}

function createCard(
  key: string,
  value: number,
  labelEn: string,
  labelAr: string,
  format?: "number" | "decimal" | "percent"
): ReportMetricCardContract {
  return {
    key,
    value,
    labelEn,
    labelAr,
    ...(format
      ? {
          format
        }
      : {})
  };
}

function toBreakdownItems<T extends { key: string; count: number; labelEn: string; labelAr: string }>(
  items: T[]
): ReportBreakdownItemContract[] {
  return items.map((item) => ({
    key: item.key,
    count: item.count,
    labelEn: item.labelEn,
    labelAr: item.labelAr
  }));
}

function buildSessionExportOptions(
  exportType: "assignments" | "attendance" | "evaluations",
  filters: ReturnType<typeof normalizeFilters>
) {
  const sessionId = filters.sessionId;

  if (!sessionId) {
    return {
      csv: null,
      excel: null,
      pdf: null
    };
  }

  const buildFormatUrl = (format: "csv" | "excel" | "pdf") => {
    const params = new URLSearchParams();
    params.set("sessionId", sessionId);
    params.set("locale", filters.locale);
    params.set("format", format);

    return `/api/export/${exportType}?${params.toString()}`;
  };

  return {
    csv: buildFormatUrl("csv"),
    excel: buildFormatUrl("excel"),
    pdf: buildFormatUrl("pdf")
  };
}

async function logReportView(input: {
  actorAppUserId: string;
  reportType: "assignments" | "attendance" | "evaluations";
  filters: ReturnType<typeof normalizeFilters>;
  cards: ReportMetricCardContract[];
  exportOptions: {
    csv: string | null;
    excel: string | null;
    pdf: string | null;
  };
}) {
  await db.$transaction(
    async (tx) => {
      await logActivity({
        client: tx,
        userId: input.actorAppUserId,
        action: "report_view",
        entityType: "report",
        entityId: randomUUID(),
        description: `Viewed ${input.reportType} report summary.`,
        metadata: {
          reportType: input.reportType,
          filters: input.filters,
          exportOptions: input.exportOptions,
          cards: input.cards
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

function normalizeKnownError(error: unknown): never {
  if (error instanceof ReportsServiceError) {
    throw error;
  }

  if (error instanceof MetricsServiceError) {
    throw new ReportsServiceError(
      error.code,
      error.status,
      error.message,
      error.details
    );
  }

  throw error;
}

export async function getAssignmentsReportSummary(
  input: ReportInput
): Promise<ReportSummaryContract> {
  const filters = normalizeFilters(input);

  try {
    const [sessionsMetrics, assignmentsMetrics] = await Promise.all([
      getSessionsMetrics({
        ...filters,
        actorAppUserId: input.actorAppUserId,
        skipActivityLog: true
      }),
      getAssignmentsMetrics({
        ...filters,
        actorAppUserId: input.actorAppUserId,
        skipActivityLog: true
      })
    ]);

    const cards: ReportMetricCardContract[] = [
      createCard(
        "totalSessions",
        sessionsMetrics.totals.totalSessions,
        "Total sessions",
        "إجمالي الجلسات"
      ),
      createCard(
        "totalAssignments",
        assignmentsMetrics.totals.totalAssignments,
        "Total assignments",
        "إجمالي التكليفات"
      ),
      createCard(
        "uniqueAssignedUsers",
        assignmentsMetrics.totals.uniqueAssignedUsers,
        "Unique assigned users",
        "عدد المراقبين الفريدين"
      ),
      createCard(
        "manualAssignments",
        assignmentsMetrics.totals.manualAssignments,
        "Manual assignments",
        "التكليفات اليدوية"
      ),
      createCard(
        "autoAssignments",
        assignmentsMetrics.totals.autoAssignments,
        "Auto assignments",
        "التكليفات الآلية"
      ),
      createCard(
        "completedAssignments",
        assignmentsMetrics.totals.completedAssignments,
        "Completed assignments",
        "التكليفات المكتملة"
      ),
      createCard(
        "cancelledAssignments",
        assignmentsMetrics.totals.cancelledAssignments,
        "Cancelled assignments",
        "التكليفات الملغاة"
      )
    ];
    const exportOptions = buildSessionExportOptions("assignments", filters);
    const result: ReportSummaryContract = {
      reportType: "assignments",
      generatedAt: new Date(),
      filters,
      cards,
      breakdowns: [
        {
          key: "status",
          titleEn: "Assignment status distribution",
          titleAr: "توزيع حالات التكليف",
          items: toBreakdownItems(assignmentsMetrics.statusBreakdown)
        },
        {
          key: "method",
          titleEn: "Assignment method distribution",
          titleAr: "توزيع طرق التكليف",
          items: toBreakdownItems(assignmentsMetrics.methodBreakdown)
        }
      ],
      exportUrl: exportOptions.csv,
      exportOptions
    };

    await logReportView({
      actorAppUserId: input.actorAppUserId,
      reportType: "assignments",
      filters,
      cards,
      exportOptions
    });

    return result;
  } catch (error) {
    normalizeKnownError(error);
  }
}

export async function getAttendanceReportSummary(
  input: ReportInput
): Promise<ReportSummaryContract> {
  const filters = normalizeFilters(input);

  try {
    const [sessionsMetrics, attendanceMetrics] = await Promise.all([
      getSessionsMetrics({
        ...filters,
        actorAppUserId: input.actorAppUserId,
        skipActivityLog: true
      }),
      getAttendanceMetrics({
        ...filters,
        actorAppUserId: input.actorAppUserId,
        skipActivityLog: true
      })
    ]);

    const attendancePercent = Number(
      (attendanceMetrics.totals.attendanceRatio * 100).toFixed(2)
    );
    const cards: ReportMetricCardContract[] = [
      createCard(
        "totalSessions",
        sessionsMetrics.totals.totalSessions,
        "Total sessions",
        "إجمالي الجلسات"
      ),
      createCard(
        "totalAssignments",
        attendanceMetrics.totals.totalAssignments,
        "Total assignments",
        "إجمالي التكليفات"
      ),
      createCard(
        "attendanceRecords",
        attendanceMetrics.totals.attendanceRecords,
        "Attendance records",
        "سجلات الحضور"
      ),
      createCard(
        "confirmedCount",
        attendanceMetrics.totals.confirmedCount,
        "Confirmed attendance",
        "حضور مؤكد"
      ),
      createCard(
        "pendingCount",
        attendanceMetrics.totals.pendingCount,
        "Pending attendance",
        "حضور قيد الانتظار"
      ),
      createCard(
        "absentCount",
        attendanceMetrics.totals.absentCount,
        "Absent attendance",
        "غياب"
      ),
      createCard(
        "attendanceRatio",
        attendancePercent,
        "Attendance ratio (%)",
        "نسبة الحضور (%)",
        "percent"
      )
    ];
    const exportOptions = buildSessionExportOptions("attendance", filters);
    const result: ReportSummaryContract = {
      reportType: "attendance",
      generatedAt: new Date(),
      filters,
      cards,
      breakdowns: [
        {
          key: "status",
          titleEn: "Attendance status distribution",
          titleAr: "توزيع حالات الحضور",
          items: toBreakdownItems(attendanceMetrics.statusBreakdown)
        }
      ],
      exportUrl: exportOptions.csv,
      exportOptions
    };

    await logReportView({
      actorAppUserId: input.actorAppUserId,
      reportType: "attendance",
      filters,
      cards,
      exportOptions
    });

    return result;
  } catch (error) {
    normalizeKnownError(error);
  }
}

export async function getEvaluationsReportSummary(
  input: ReportInput
): Promise<ReportSummaryContract> {
  const filters = normalizeFilters(input);

  try {
    await getSessionsMetrics({
      ...filters,
      actorAppUserId: input.actorAppUserId,
      skipActivityLog: true
    });

    const whereClauses: string[] = [];
    const whereParams: string[] = [];

    if (filters.sessionId) {
      whereParams.push(filters.sessionId);
      whereClauses.push(`e.session_id = $${whereParams.length}::uuid`);
    }

    if (filters.cycleId) {
      whereParams.push(filters.cycleId);
      whereClauses.push(`s.cycle_id = $${whereParams.length}::uuid`);
    }

    if (filters.locationId) {
      whereParams.push(filters.locationId);
      whereClauses.push(
        `EXISTS (` +
          `SELECT 1 FROM session_buildings sb ` +
          `WHERE sb.session_id = s.id ` +
          `AND sb.building_id = $${whereParams.length}::uuid ` +
          `AND sb.is_active = true` +
          `)`
      );
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const evaluationRows = await db.$queryRawUnsafe<EvaluationSummaryRow[]>(
      `SELECT ` +
        `e.score::text AS "score", ` +
        `e.subject_user_id AS "subjectUserId", ` +
        `e.session_id AS "sessionId" ` +
        `FROM evaluations e ` +
        `INNER JOIN sessions s ON s.id = e.session_id ` +
        `${whereSql}`,
      ...whereParams
    );

    const totalEvaluations = evaluationRows.length;
    const uniqueUsers = new Set(evaluationRows.map((row) => row.subjectUserId));
    const uniqueSessions = new Set(evaluationRows.map((row) => row.sessionId));
    const averageScore =
      totalEvaluations === 0
        ? 0
        : Number(
            (
              evaluationRows.reduce(
                (sum, row) => sum + toNumber(row.score),
                0
              ) / totalEvaluations
            ).toFixed(2)
          );
    const scoreBucketCounts = evaluationScoreBuckets.map((bucket) => ({
      key: bucket.key,
      labelEn: bucket.labelEn,
      labelAr: bucket.labelAr,
      count: evaluationRows.reduce((sum, row) => {
        const score = toNumber(row.score);
        return bucket.check(score) ? sum + 1 : sum;
      }, 0)
    }));
    const cards: ReportMetricCardContract[] = [
      createCard(
        "totalEvaluations",
        totalEvaluations,
        "Total evaluations",
        "إجمالي التقييمات"
      ),
      createCard(
        "averageScore",
        averageScore,
        "Average score",
        "متوسط التقييم",
        "decimal"
      ),
      createCard(
        "evaluatedUsers",
        uniqueUsers.size,
        "Evaluated users",
        "المستخدمون المقيمون"
      ),
      createCard(
        "evaluatedSessions",
        uniqueSessions.size,
        "Evaluated sessions",
        "الجلسات المقيمة"
      )
    ];
    const exportOptions = buildSessionExportOptions("evaluations", filters);
    const result: ReportSummaryContract = {
      reportType: "evaluations",
      generatedAt: new Date(),
      filters,
      cards,
      breakdowns: [
        {
          key: "scoreBuckets",
          titleEn: "Evaluation score buckets",
          titleAr: "تصنيف درجات التقييم",
          items: scoreBucketCounts
        }
      ],
      exportUrl: exportOptions.csv,
      exportOptions
    };

    await logReportView({
      actorAppUserId: input.actorAppUserId,
      reportType: "evaluations",
      filters,
      cards,
      exportOptions
    });

    return result;
  } catch (error) {
    normalizeKnownError(error);
  }
}
