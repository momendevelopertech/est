import { randomUUID } from "node:crypto";

import {
  AssignmentMethod,
  AssignmentStatus,
  AttendanceStatus,
  Prisma,
  SessionStatus
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { getAssignments } from "@/lib/assignments/service";
import { getAttendanceAssignments } from "@/lib/attendance/service";
import { type CsvCell, stringifyCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";

import type {
  SessionExportFileContract,
  SessionExportFormat,
  SessionExportLocale,
  SessionExportType
} from "./contracts";
import type { SessionExportQuery } from "./validation";

const assignmentExportHeaders = [
  "Assignment ID / معرف التكليف",
  "Session ID / معرف الجلسة",
  "Session Name (AR) / اسم الجلسة (عربي)",
  "Session Name (EN) / Session Name (EN)",
  "Session Date / تاريخ الجلسة",
  "Session Status / حالة الجلسة",
  "User ID / معرف المراقب",
  "User Name (AR) / اسم المراقب (عربي)",
  "User Name (EN) / Proctor Name (EN)",
  "Phone / الهاتف",
  "Role Key / مفتاح الدور",
  "Role Name (AR) / اسم الدور (عربي)",
  "Role Name (EN) / Role Name (EN)",
  "Building Code / كود المبنى",
  "Building Name (AR) / اسم المبنى (عربي)",
  "Building Name (EN) / Building Name (EN)",
  "Floor Code / كود الدور",
  "Floor Name (AR) / اسم الدور (عربي)",
  "Floor Name (EN) / Floor Name (EN)",
  "Room Code / كود القاعة",
  "Room Name (AR) / اسم القاعة (عربي)",
  "Room Name (EN) / Room Name (EN)",
  "Assignment Status / حالة التكليف",
  "Assigned Method / طريقة التكليف",
  "Manual Override / تجاوز يدوي",
  "Assigned At / وقت التكليف",
  "Updated At / وقت التحديث"
] as const;

const attendanceExportHeaders = [
  "Assignment ID / معرف التكليف",
  "Session ID / معرف الجلسة",
  "Session Name (AR) / اسم الجلسة (عربي)",
  "Session Name (EN) / Session Name (EN)",
  "Session Date / تاريخ الجلسة",
  "Session Status / حالة الجلسة",
  "User ID / معرف المراقب",
  "User Name (AR) / اسم المراقب (عربي)",
  "User Name (EN) / Proctor Name (EN)",
  "Phone / الهاتف",
  "Role Key / مفتاح الدور",
  "Role Name (AR) / اسم الدور (عربي)",
  "Role Name (EN) / Role Name (EN)",
  "Building Code / كود المبنى",
  "Building Name (AR) / اسم المبنى (عربي)",
  "Building Name (EN) / Building Name (EN)",
  "Attendance ID / معرف الحضور",
  "Attendance Status / حالة الحضور",
  "Checked In At / وقت تسجيل الحضور",
  "Attendance Notes / ملاحظات الحضور",
  "Attendance Updated By / تم التحديث بواسطة",
  "Attendance Updated At / وقت تحديث الحضور",
  "Assignment Status / حالة التكليف",
  "Assigned Method / طريقة التكليف",
  "Assigned At / وقت التكليف"
] as const;

const sessionStatusLabels: Record<SessionStatus, string> = {
  DRAFT: "Draft / مسودة",
  SCHEDULED: "Scheduled / مجدولة",
  LOCKED: "Locked / مقفلة",
  IN_PROGRESS: "In Progress / قيد التنفيذ",
  COMPLETED: "Completed / مكتملة",
  CANCELLED: "Cancelled / ملغاة"
};

const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  DRAFT: "Draft / مسودة",
  CONFIRMED: "Confirmed / مؤكدة",
  LOCKED: "Locked / مقفلة",
  CANCELLED: "Cancelled / ملغاة",
  COMPLETED: "Completed / مكتملة"
};

const assignmentMethodLabels: Record<AssignmentMethod, string> = {
  AUTO: "Auto / آلي",
  MANUAL: "Manual / يدوي"
};

const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  PENDING: "Pending / قيد الانتظار",
  CONFIRMED: "Confirmed / تم التأكيد",
  ABSENT: "Absent / غائب",
  DECLINED: "Declined / اعتذار"
};

const exportSessionSelect = {
  id: true,
  name: true,
  nameEn: true,
  sessionDate: true,
  status: true,
  isActive: true,
  cycle: {
    select: {
      id: true,
      isActive: true
    }
  }
} satisfies Prisma.SessionSelect;

type ExportSessionRecord = Prisma.SessionGetPayload<{
  select: typeof exportSessionSelect;
}>;

type AssignmentExportRecord = Awaited<ReturnType<typeof getAssignments>>["data"][number];
type AttendanceExportRecord = Awaited<
  ReturnType<typeof getAttendanceAssignments>
>["data"][number];

const exportPageSize = 500;

export class ExportServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ExportServiceError";
  }
}

function formatIsoDate(value?: Date | null) {
  return value ? value.toISOString() : "";
}

function formatBoolBilingual(value: boolean) {
  return value ? "Yes / نعم" : "No / لا";
}

function resolveFormat(format?: SessionExportFormat): SessionExportFormat {
  return format ?? "csv";
}

function resolveLocale(locale?: SessionExportLocale): SessionExportLocale {
  return locale === "ar" ? "ar" : "en";
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildExportFileName(input: {
  sessionId: string;
  exportType: SessionExportType;
  generatedAt: Date;
}) {
  const timestamp = input.generatedAt.toISOString().replace(/[:.]/g, "-");
  const sessionPart = sanitizeFilePart(input.sessionId);

  return `examops-session-${sessionPart}-${input.exportType}-export-${timestamp}.csv`;
}

async function assertSessionExists(sessionId: string) {
  const session = await db.session.findUnique({
    where: {
      id: sessionId
    },
    select: exportSessionSelect
  });

  if (!session) {
    throw new ExportServiceError(
      ERROR_CODES.sessionNotFound,
      404,
      "Session not found."
    );
  }

  return session;
}

async function collectSessionAssignments(sessionId: string) {
  const rows: AssignmentExportRecord[] = [];
  let page = 1;

  while (true) {
    const result = await getAssignments({
      sessionId,
      page,
      pageSize: exportPageSize
    });

    rows.push(...result.data);

    if (!result.pagination.hasNextPage) {
      break;
    }

    page += 1;
  }

  return rows;
}

async function collectSessionAttendance(sessionId: string) {
  const rows: AttendanceExportRecord[] = [];
  let page = 1;

  while (true) {
    const result = await getAttendanceAssignments({
      sessionId,
      page,
      pageSize: exportPageSize
    });

    rows.push(...result.data);

    if (!result.pagination.hasNextPage) {
      break;
    }

    page += 1;
  }

  return rows;
}

function dedupeByKey<T>(rows: T[], getKey: (row: T) => string) {
  const seen = new Set<string>();
  const dedupedRows: T[] = [];
  let duplicateRowsRemoved = 0;

  for (const row of rows) {
    const key = getKey(row);

    if (seen.has(key)) {
      duplicateRowsRemoved += 1;
      continue;
    }

    seen.add(key);
    dedupedRows.push(row);
  }

  return {
    dedupedRows,
    duplicateRowsRemoved
  };
}

function buildAssignmentsCsvRows(rows: AssignmentExportRecord[]): CsvCell[][] {
  const body = rows.map((row) => [
    row.id,
    row.sessionId,
    row.session.name ?? "",
    row.session.nameEn ?? "",
    formatIsoDate(row.session.sessionDate),
    sessionStatusLabels[row.session.status],
    row.userId,
    row.user.name ?? "",
    row.user.nameEn ?? "",
    row.user.phone ?? "",
    row.roleDefinition.key ?? "",
    row.roleDefinition.name ?? "",
    row.roleDefinition.nameEn ?? "",
    row.building.code ?? "",
    row.building.name ?? "",
    row.building.nameEn ?? "",
    row.floor?.code ?? "",
    row.floor?.name ?? "",
    row.floor?.nameEn ?? "",
    row.room?.code ?? "",
    row.room?.name ?? "",
    row.room?.nameEn ?? "",
    assignmentStatusLabels[row.status],
    assignmentMethodLabels[row.assignedMethod],
    formatBoolBilingual(row.isManualOverride),
    formatIsoDate(row.assignedAt),
    formatIsoDate(row.updatedAt)
  ]);

  return [Array.from(assignmentExportHeaders), ...body];
}

function buildAttendanceCsvRows(
  rows: AttendanceExportRecord[],
  assignmentsById: Map<string, AssignmentExportRecord>
): CsvCell[][] {
  const body = rows.map((row) => {
    const attendanceStatus = row.attendance?.status ?? AttendanceStatus.PENDING;
    const assignmentSnapshot = assignmentsById.get(row.id);

    return [
      row.id,
      row.sessionId,
      row.session.name ?? "",
      row.session.nameEn ?? "",
      formatIsoDate(row.session.startsAt ?? row.session.endsAt),
      sessionStatusLabels[row.session.status],
      row.userId,
      row.user.name ?? "",
      row.user.nameEn ?? "",
      assignmentSnapshot?.user.phone ?? "",
      row.roleDefinition.key ?? "",
      row.roleDefinition.name ?? "",
      row.roleDefinition.nameEn ?? "",
      assignmentSnapshot?.building.code ?? "",
      row.building.name ?? "",
      row.building.nameEn ?? "",
      row.attendance?.id ?? "",
      attendanceStatusLabels[attendanceStatus],
      formatIsoDate(row.attendance?.checkedInAt),
      row.attendance?.notes ?? "",
      row.attendance?.updatedByAppUser?.displayName ?? "",
      formatIsoDate(row.attendance?.updatedAt),
      assignmentStatusLabels[row.status],
      assignmentMethodLabels[row.assignedMethod],
      formatIsoDate(row.assignedAt)
    ];
  });

  return [Array.from(attendanceExportHeaders), ...body];
}

async function logExportAction(input: {
  actorAppUserId: string;
  exportType: SessionExportType;
  session: ExportSessionRecord;
  locale: SessionExportLocale;
  format: SessionExportFormat;
  rowCount: number;
  duplicateRowsRemoved: number;
  fileName: string;
}) {
  await db.$transaction(
    async (tx) => {
      await logActivity({
        client: tx,
        userId: input.actorAppUserId,
        action: "export_generate",
        entityType: "export",
        entityId: randomUUID(),
        description: `Generated ${input.exportType} export for session ${input.session.name}.`,
        metadata: {
          exportType: input.exportType,
          sessionId: input.session.id,
          locale: input.locale,
          format: input.format,
          rowCount: input.rowCount,
          duplicateRowsRemoved: input.duplicateRowsRemoved,
          fileName: input.fileName
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

export async function generateAssignmentsSessionExport(
  input: SessionExportQuery & {
    actorAppUserId: string;
  }
): Promise<SessionExportFileContract> {
  const format = resolveFormat(input.format);
  const locale = resolveLocale(input.locale);
  const session = await assertSessionExists(input.sessionId);
  const generatedAt = new Date();
  const allRows = await collectSessionAssignments(session.id);
  const { dedupedRows, duplicateRowsRemoved } = dedupeByKey(
    allRows,
    (row) => row.id
  );
  const csvRows = buildAssignmentsCsvRows(dedupedRows);
  const content = `\uFEFF${stringifyCsv(csvRows)}`;
  const fileName = buildExportFileName({
    sessionId: session.id,
    exportType: "assignments",
    generatedAt
  });

  await logExportAction({
    actorAppUserId: input.actorAppUserId,
    exportType: "assignments",
    session,
    locale,
    format,
    rowCount: dedupedRows.length,
    duplicateRowsRemoved,
    fileName
  });

  return {
    exportType: "assignments",
    sessionId: session.id,
    format,
    locale,
    fileName,
    contentType: "text/csv; charset=utf-8",
    content,
    generatedAt,
    rowCount: dedupedRows.length,
    duplicateRowsRemoved
  };
}

export async function generateAttendanceSessionExport(
  input: SessionExportQuery & {
    actorAppUserId: string;
  }
): Promise<SessionExportFileContract> {
  const format = resolveFormat(input.format);
  const locale = resolveLocale(input.locale);
  const session = await assertSessionExists(input.sessionId);
  const generatedAt = new Date();
  const assignmentRows = await collectSessionAssignments(session.id);
  const { dedupedRows: dedupedAssignmentRows } = dedupeByKey(
    assignmentRows,
    (row) => row.id
  );
  const assignmentsById = new Map(
    dedupedAssignmentRows.map((row) => [row.id, row])
  );
  const allRows = await collectSessionAttendance(session.id);
  const { dedupedRows, duplicateRowsRemoved } = dedupeByKey(
    allRows,
    (row) => row.id
  );
  const csvRows = buildAttendanceCsvRows(dedupedRows, assignmentsById);
  const content = `\uFEFF${stringifyCsv(csvRows)}`;
  const fileName = buildExportFileName({
    sessionId: session.id,
    exportType: "attendance",
    generatedAt
  });

  await logExportAction({
    actorAppUserId: input.actorAppUserId,
    exportType: "attendance",
    session,
    locale,
    format,
    rowCount: dedupedRows.length,
    duplicateRowsRemoved,
    fileName
  });

  return {
    exportType: "attendance",
    sessionId: session.id,
    format,
    locale,
    fileName,
    contentType: "text/csv; charset=utf-8",
    content,
    generatedAt,
    rowCount: dedupedRows.length,
    duplicateRowsRemoved
  };
}
