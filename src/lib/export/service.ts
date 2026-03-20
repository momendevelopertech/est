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
import { stringifyCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { getEvaluations } from "@/lib/evaluations/service";
import { createSpreadsheetXml } from "@/lib/tabular";

import type {
  SessionExportFileContract,
  SessionExportFormat,
  SessionExportLocale,
  SessionExportType
} from "./contracts";
import { createTabularPdf } from "./pdf";
import type { SessionExportQuery } from "./validation";

type ExportColumn = {
  key: string;
  en: string;
  ar: string;
};

const assignmentColumns: ExportColumn[] = [
  { key: "assignmentId", en: "Assignment ID", ar: "معرف التكليف" },
  { key: "sessionId", en: "Session ID", ar: "معرف الجلسة" },
  { key: "sessionNameAr", en: "Session Name (AR)", ar: "اسم الجلسة (عربي)" },
  { key: "sessionNameEn", en: "Session Name (EN)", ar: "اسم الجلسة (إنجليزي)" },
  { key: "sessionDate", en: "Session Date", ar: "تاريخ الجلسة" },
  { key: "sessionStatus", en: "Session Status", ar: "حالة الجلسة" },
  { key: "userId", en: "User ID", ar: "معرف المراقب" },
  { key: "userNameAr", en: "User Name (AR)", ar: "اسم المراقب (عربي)" },
  { key: "userNameEn", en: "User Name (EN)", ar: "اسم المراقب (إنجليزي)" },
  { key: "phone", en: "Phone", ar: "الهاتف" },
  { key: "roleKey", en: "Role Key", ar: "مفتاح الدور" },
  { key: "roleNameAr", en: "Role Name (AR)", ar: "اسم الدور (عربي)" },
  { key: "roleNameEn", en: "Role Name (EN)", ar: "اسم الدور (إنجليزي)" },
  { key: "buildingCode", en: "Building Code", ar: "كود المبنى" },
  { key: "buildingNameAr", en: "Building Name (AR)", ar: "اسم المبنى (عربي)" },
  { key: "buildingNameEn", en: "Building Name (EN)", ar: "اسم المبنى (إنجليزي)" },
  { key: "floorCode", en: "Floor Code", ar: "كود الدور" },
  { key: "floorNameAr", en: "Floor Name (AR)", ar: "اسم الدور (عربي)" },
  { key: "floorNameEn", en: "Floor Name (EN)", ar: "اسم الدور (إنجليزي)" },
  { key: "roomCode", en: "Room Code", ar: "كود القاعة" },
  { key: "roomNameAr", en: "Room Name (AR)", ar: "اسم القاعة (عربي)" },
  { key: "roomNameEn", en: "Room Name (EN)", ar: "اسم القاعة (إنجليزي)" },
  { key: "assignmentStatus", en: "Assignment Status", ar: "حالة التكليف" },
  { key: "assignmentMethod", en: "Assigned Method", ar: "طريقة التكليف" },
  { key: "manualOverride", en: "Manual Override", ar: "تجاوز يدوي" },
  { key: "assignedAt", en: "Assigned At", ar: "وقت التكليف" },
  { key: "updatedAt", en: "Updated At", ar: "وقت التحديث" }
] as const;

const attendanceColumns: ExportColumn[] = [
  { key: "assignmentId", en: "Assignment ID", ar: "معرف التكليف" },
  { key: "sessionId", en: "Session ID", ar: "معرف الجلسة" },
  { key: "sessionNameAr", en: "Session Name (AR)", ar: "اسم الجلسة (عربي)" },
  { key: "sessionNameEn", en: "Session Name (EN)", ar: "اسم الجلسة (إنجليزي)" },
  { key: "sessionDate", en: "Session Date", ar: "تاريخ الجلسة" },
  { key: "sessionStatus", en: "Session Status", ar: "حالة الجلسة" },
  { key: "userId", en: "User ID", ar: "معرف المراقب" },
  { key: "userNameAr", en: "User Name (AR)", ar: "اسم المراقب (عربي)" },
  { key: "userNameEn", en: "User Name (EN)", ar: "اسم المراقب (إنجليزي)" },
  { key: "phone", en: "Phone", ar: "الهاتف" },
  { key: "roleKey", en: "Role Key", ar: "مفتاح الدور" },
  { key: "roleNameAr", en: "Role Name (AR)", ar: "اسم الدور (عربي)" },
  { key: "roleNameEn", en: "Role Name (EN)", ar: "اسم الدور (إنجليزي)" },
  { key: "buildingCode", en: "Building Code", ar: "كود المبنى" },
  { key: "buildingNameAr", en: "Building Name (AR)", ar: "اسم المبنى (عربي)" },
  { key: "buildingNameEn", en: "Building Name (EN)", ar: "اسم المبنى (إنجليزي)" },
  { key: "attendanceId", en: "Attendance ID", ar: "معرف الحضور" },
  { key: "attendanceStatus", en: "Attendance Status", ar: "حالة الحضور" },
  { key: "checkedInAt", en: "Checked In At", ar: "وقت تسجيل الحضور" },
  { key: "attendanceNotes", en: "Attendance Notes", ar: "ملاحظات الحضور" },
  {
    key: "attendanceUpdatedBy",
    en: "Attendance Updated By",
    ar: "تم التحديث بواسطة"
  },
  { key: "attendanceUpdatedAt", en: "Attendance Updated At", ar: "وقت تحديث الحضور" },
  { key: "assignmentStatus", en: "Assignment Status", ar: "حالة التكليف" },
  { key: "assignmentMethod", en: "Assigned Method", ar: "طريقة التكليف" },
  { key: "assignedAt", en: "Assigned At", ar: "وقت التكليف" }
] as const;

const evaluationColumns: ExportColumn[] = [
  { key: "evaluationId", en: "Evaluation ID", ar: "معرف التقييم" },
  { key: "assignmentId", en: "Assignment ID", ar: "معرف التكليف" },
  { key: "sessionId", en: "Session ID", ar: "معرف الجلسة" },
  { key: "sessionNameAr", en: "Session Name (AR)", ar: "اسم الجلسة (عربي)" },
  { key: "sessionNameEn", en: "Session Name (EN)", ar: "اسم الجلسة (إنجليزي)" },
  { key: "sessionStatus", en: "Session Status", ar: "حالة الجلسة" },
  { key: "sessionDate", en: "Session Date", ar: "تاريخ الجلسة" },
  { key: "subjectUserId", en: "Subject User ID", ar: "معرف المراقب المُقيّم" },
  {
    key: "subjectUserNameAr",
    en: "Subject User Name (AR)",
    ar: "اسم المراقب المُقيّم (عربي)"
  },
  {
    key: "subjectUserNameEn",
    en: "Subject User Name (EN)",
    ar: "اسم المراقب المُقيّم (إنجليزي)"
  },
  { key: "subjectPhone", en: "Phone", ar: "الهاتف" },
  { key: "roleKey", en: "Role Key", ar: "مفتاح الدور" },
  { key: "roleNameAr", en: "Role Name (AR)", ar: "اسم الدور (عربي)" },
  { key: "roleNameEn", en: "Role Name (EN)", ar: "اسم الدور (إنجليزي)" },
  { key: "buildingNameAr", en: "Building Name (AR)", ar: "اسم المبنى (عربي)" },
  { key: "buildingNameEn", en: "Building Name (EN)", ar: "اسم المبنى (إنجليزي)" },
  { key: "score", en: "Score", ar: "الدرجة" },
  { key: "notes", en: "Notes", ar: "ملاحظات" },
  { key: "evaluatorId", en: "Evaluator App User ID", ar: "معرف المُقيّم" },
  { key: "evaluatorName", en: "Evaluator Name", ar: "اسم المُقيّم" },
  { key: "createdAt", en: "Created At", ar: "وقت الإنشاء" },
  { key: "updatedAt", en: "Updated At", ar: "وقت التحديث" }
] as const;

const assignmentPdfColumns: ExportColumn[] = [
  { key: "sessionName", en: "Session", ar: "الجلسة" },
  { key: "sessionDate", en: "Date", ar: "التاريخ" },
  { key: "userName", en: "Proctor", ar: "المراقب" },
  { key: "phone", en: "Phone", ar: "الهاتف" },
  { key: "role", en: "Role", ar: "الدور" },
  { key: "building", en: "Building", ar: "المبنى" },
  { key: "room", en: "Room", ar: "القاعة" },
  { key: "status", en: "Status", ar: "الحالة" },
  { key: "method", en: "Method", ar: "الطريقة" }
] as const;

const attendancePdfColumns: ExportColumn[] = [
  { key: "sessionName", en: "Session", ar: "الجلسة" },
  { key: "userName", en: "Proctor", ar: "المراقب" },
  { key: "role", en: "Role", ar: "الدور" },
  { key: "building", en: "Building", ar: "المبنى" },
  { key: "attendanceStatus", en: "Attendance", ar: "الحضور" },
  { key: "checkedInAt", en: "Checked In", ar: "وقت التسجيل" },
  { key: "assignmentStatus", en: "Assignment", ar: "التكليف" }
] as const;

const evaluationPdfColumns: ExportColumn[] = [
  { key: "sessionName", en: "Session", ar: "الجلسة" },
  { key: "userName", en: "Proctor", ar: "المراقب" },
  { key: "role", en: "Role", ar: "الدور" },
  { key: "building", en: "Building", ar: "المبنى" },
  { key: "score", en: "Score", ar: "الدرجة" },
  { key: "evaluator", en: "Evaluator", ar: "المُقيّم" },
  { key: "createdAt", en: "Created At", ar: "وقت الإنشاء" }
] as const;

const sessionStatusLabels: Record<
  SessionStatus,
  {
    en: string;
    ar: string;
  }
> = {
  DRAFT: { en: "Draft", ar: "مسودة" },
  SCHEDULED: { en: "Scheduled", ar: "مجدولة" },
  LOCKED: { en: "Locked", ar: "مقفلة" },
  IN_PROGRESS: { en: "In Progress", ar: "قيد التنفيذ" },
  COMPLETED: { en: "Completed", ar: "مكتملة" },
  CANCELLED: { en: "Cancelled", ar: "ملغاة" }
};

const assignmentStatusLabels: Record<
  AssignmentStatus,
  {
    en: string;
    ar: string;
  }
> = {
  DRAFT: { en: "Draft", ar: "مسودة" },
  CONFIRMED: { en: "Confirmed", ar: "مؤكدة" },
  LOCKED: { en: "Locked", ar: "مقفلة" },
  CANCELLED: { en: "Cancelled", ar: "ملغاة" },
  COMPLETED: { en: "Completed", ar: "مكتملة" }
};

const assignmentMethodLabels: Record<
  AssignmentMethod,
  {
    en: string;
    ar: string;
  }
> = {
  AUTO: { en: "Auto", ar: "آلي" },
  MANUAL: { en: "Manual", ar: "يدوي" }
};

const attendanceStatusLabels: Record<
  AttendanceStatus,
  {
    en: string;
    ar: string;
  }
> = {
  PENDING: { en: "Pending", ar: "قيد الانتظار" },
  CONFIRMED: { en: "Confirmed", ar: "تم التأكيد" },
  ABSENT: { en: "Absent", ar: "غائب" },
  DECLINED: { en: "Declined", ar: "اعتذار" }
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
type EvaluationExportRecord = Awaited<ReturnType<typeof getEvaluations>>["data"][number];

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

function toLabel(
  value: {
    en: string;
    ar: string;
  },
  locale: SessionExportLocale
) {
  return locale === "ar" ? value.ar : value.en;
}

function toBilingualLabel(value: {
  en: string;
  ar: string;
}) {
  return `${value.en} / ${value.ar}`;
}

function formatIsoDate(value?: Date | null) {
  return value ? value.toISOString() : "";
}

function formatBoolBilingual(value: boolean) {
  return value ? "Yes / نعم" : "No / لا";
}

function formatScore(value: Prisma.Decimal | string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numeric = Number(value.toString());
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
}

function resolveFormat(format?: SessionExportFormat): SessionExportFormat {
  if (format === "excel" || format === "pdf") {
    return format;
  }

  return "csv";
}

function resolveLocale(locale?: SessionExportLocale): SessionExportLocale {
  return locale === "ar" ? "ar" : "en";
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function toFileExtension(format: SessionExportFormat) {
  if (format === "excel") {
    return "xls";
  }

  if (format === "pdf") {
    return "pdf";
  }

  return "csv";
}

function toContentType(format: SessionExportFormat) {
  if (format === "excel") {
    return "application/vnd.ms-excel; charset=utf-8";
  }

  if (format === "pdf") {
    return "application/pdf";
  }

  return "text/csv; charset=utf-8";
}

function buildExportFileName(input: {
  sessionId: string;
  exportType: SessionExportType;
  format: SessionExportFormat;
  generatedAt: Date;
}) {
  const timestamp = input.generatedAt.toISOString().replace(/[:.]/g, "-");
  const sessionPart = sanitizeFilePart(input.sessionId);
  const extension = toFileExtension(input.format);

  return `examops-session-${sessionPart}-${input.exportType}-export-${timestamp}.${extension}`;
}

function toCsvHeaderRow(columns: readonly ExportColumn[]) {
  return columns.map((column) => `${column.en} / ${column.ar}`);
}

function toExcelHeaderRows(columns: readonly ExportColumn[]) {
  return [
    columns.map((column) => column.ar),
    columns.map((column) => column.en)
  ];
}

function toPdfHeaders(columns: readonly ExportColumn[], locale: SessionExportLocale) {
  return columns.map((column) => (locale === "ar" ? column.ar : column.en));
}

function buildCsvContent(columns: readonly ExportColumn[], rows: string[][]) {
  const csvRows = [toCsvHeaderRow(columns), ...rows];
  return `\uFEFF${stringifyCsv(csvRows)}`;
}

function buildExcelContent(input: {
  sheetName: string;
  columns: readonly ExportColumn[];
  rows: string[][];
}) {
  return createSpreadsheetXml({
    sheetName: input.sheetName,
    headerRows: toExcelHeaderRows(input.columns),
    rows: input.rows
  });
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

async function collectSessionEvaluations(sessionId: string) {
  const rows: EvaluationExportRecord[] = [];
  let page = 1;

  while (true) {
    const result = await getEvaluations({
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

function buildAssignmentsRows(rows: AssignmentExportRecord[]) {
  return rows.map((row) => [
    row.id,
    row.sessionId,
    row.session.name ?? "",
    row.session.nameEn ?? "",
    formatIsoDate(row.session.sessionDate),
    toBilingualLabel(sessionStatusLabels[row.session.status]),
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
    toBilingualLabel(assignmentStatusLabels[row.status]),
    toBilingualLabel(assignmentMethodLabels[row.assignedMethod]),
    formatBoolBilingual(row.isManualOverride),
    formatIsoDate(row.assignedAt),
    formatIsoDate(row.updatedAt)
  ]);
}

function buildAssignmentsPdfRows(
  rows: AssignmentExportRecord[],
  locale: SessionExportLocale
) {
  return rows.map((row) => [
    locale === "ar"
      ? row.session.name || row.session.nameEn || row.sessionId
      : row.session.nameEn || row.session.name || row.sessionId,
    formatIsoDate(row.session.sessionDate),
    locale === "ar"
      ? row.user.name || row.user.nameEn || row.userId
      : row.user.nameEn || row.user.name || row.userId,
    row.user.phone ?? "",
    locale === "ar"
      ? row.roleDefinition.name || row.roleDefinition.nameEn || row.roleDefinition.key
      : row.roleDefinition.nameEn || row.roleDefinition.name || row.roleDefinition.key,
    locale === "ar"
      ? row.building.name || row.building.nameEn || row.building.id
      : row.building.nameEn || row.building.name || row.building.id,
    locale === "ar"
      ? row.room?.name || row.room?.nameEn || row.room?.id || "-"
      : row.room?.nameEn || row.room?.name || row.room?.id || "-",
    toLabel(assignmentStatusLabels[row.status], locale),
    toLabel(assignmentMethodLabels[row.assignedMethod], locale)
  ]);
}

function buildAttendanceRows(
  rows: AttendanceExportRecord[],
  assignmentsById: Map<string, AssignmentExportRecord>
) {
  return rows.map((row) => {
    const attendanceStatus = row.attendance?.status ?? AttendanceStatus.PENDING;
    const assignmentSnapshot = assignmentsById.get(row.id);

    return [
      row.id,
      row.sessionId,
      row.session.name ?? "",
      row.session.nameEn ?? "",
      formatIsoDate(row.session.startsAt ?? row.session.endsAt),
      toBilingualLabel(sessionStatusLabels[row.session.status]),
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
      toBilingualLabel(attendanceStatusLabels[attendanceStatus]),
      formatIsoDate(row.attendance?.checkedInAt),
      row.attendance?.notes ?? "",
      row.attendance?.updatedByAppUser?.displayName ?? "",
      formatIsoDate(row.attendance?.updatedAt),
      toBilingualLabel(assignmentStatusLabels[row.status]),
      toBilingualLabel(assignmentMethodLabels[row.assignedMethod]),
      formatIsoDate(row.assignedAt)
    ];
  });
}

function buildAttendancePdfRows(
  rows: AttendanceExportRecord[],
  locale: SessionExportLocale
) {
  return rows.map((row) => {
    const attendanceStatus = row.attendance?.status ?? AttendanceStatus.PENDING;

    return [
      locale === "ar"
        ? row.session.name || row.session.nameEn || row.sessionId
        : row.session.nameEn || row.session.name || row.sessionId,
      locale === "ar"
        ? row.user.name || row.user.nameEn || row.userId
        : row.user.nameEn || row.user.name || row.userId,
      locale === "ar"
        ? row.roleDefinition.name || row.roleDefinition.nameEn || row.roleDefinition.key
        : row.roleDefinition.nameEn || row.roleDefinition.name || row.roleDefinition.key,
      locale === "ar"
        ? row.building.name || row.building.nameEn || row.building.id
        : row.building.nameEn || row.building.name || row.building.id,
      toLabel(attendanceStatusLabels[attendanceStatus], locale),
      formatIsoDate(row.attendance?.checkedInAt),
      toLabel(assignmentStatusLabels[row.status], locale)
    ];
  });
}

function buildEvaluationRows(rows: EvaluationExportRecord[]) {
  return rows.map((row) => [
    row.id,
    row.assignmentId ?? "",
    row.sessionId,
    row.session.name ?? "",
    row.session.nameEn ?? "",
    toBilingualLabel(sessionStatusLabels[row.session.status]),
    formatIsoDate(row.session.startsAt ?? row.session.endsAt),
    row.subjectUserId,
    row.subjectUser.name ?? "",
    row.subjectUser.nameEn ?? "",
    row.subjectUser.phone ?? "",
    row.assignment?.roleDefinition.key ?? "",
    row.assignment?.roleDefinition.name ?? "",
    row.assignment?.roleDefinition.nameEn ?? "",
    row.assignment?.building.name ?? "",
    row.assignment?.building.nameEn ?? "",
    formatScore(row.score),
    row.notes ?? "",
    row.evaluatorAppUserId,
    row.evaluatorAppUser.displayName ?? "",
    formatIsoDate(row.createdAt),
    formatIsoDate(row.updatedAt)
  ]);
}

function buildEvaluationPdfRows(
  rows: EvaluationExportRecord[],
  locale: SessionExportLocale
) {
  return rows.map((row) => [
    locale === "ar"
      ? row.session.name || row.session.nameEn || row.sessionId
      : row.session.nameEn || row.session.name || row.sessionId,
    locale === "ar"
      ? row.subjectUser.name || row.subjectUser.nameEn || row.subjectUserId
      : row.subjectUser.nameEn || row.subjectUser.name || row.subjectUserId,
    locale === "ar"
      ? row.assignment?.roleDefinition.name ||
        row.assignment?.roleDefinition.nameEn ||
        row.assignment?.roleDefinition.key ||
        "-"
      : row.assignment?.roleDefinition.nameEn ||
        row.assignment?.roleDefinition.name ||
        row.assignment?.roleDefinition.key ||
        "-",
    locale === "ar"
      ? row.assignment?.building.name || row.assignment?.building.nameEn || "-"
      : row.assignment?.building.nameEn || row.assignment?.building.name || "-",
    formatScore(row.score),
    row.evaluatorAppUser.displayName ?? row.evaluatorAppUserId,
    formatIsoDate(row.createdAt)
  ]);
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

async function finalizeSessionExport(input: {
  actorAppUserId: string;
  session: ExportSessionRecord;
  exportType: SessionExportType;
  format: SessionExportFormat;
  locale: SessionExportLocale;
  generatedAt: Date;
  rowCount: number;
  duplicateRowsRemoved: number;
  content: string | Uint8Array;
}) {
  const fileName = buildExportFileName({
    sessionId: input.session.id,
    exportType: input.exportType,
    format: input.format,
    generatedAt: input.generatedAt
  });

  await logExportAction({
    actorAppUserId: input.actorAppUserId,
    exportType: input.exportType,
    session: input.session,
    locale: input.locale,
    format: input.format,
    rowCount: input.rowCount,
    duplicateRowsRemoved: input.duplicateRowsRemoved,
    fileName
  });

  return {
    exportType: input.exportType,
    sessionId: input.session.id,
    format: input.format,
    locale: input.locale,
    fileName,
    contentType: toContentType(input.format),
    content: input.content,
    generatedAt: input.generatedAt,
    rowCount: input.rowCount,
    duplicateRowsRemoved: input.duplicateRowsRemoved
  } satisfies SessionExportFileContract;
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

  let content: string | Uint8Array;

  if (format === "excel") {
    content = buildExcelContent({
      sheetName: locale === "ar" ? "تقرير التكليفات" : "Assignments Export",
      columns: assignmentColumns,
      rows: buildAssignmentsRows(dedupedRows)
    });
  } else if (format === "pdf") {
    content = await createTabularPdf({
      locale,
      title: locale === "ar" ? "تصدير التكليفات" : "Assignments Export",
      subtitle:
        locale === "ar"
          ? `الجلسة: ${session.name || session.nameEn || session.id}`
          : `Session: ${session.nameEn || session.name || session.id}`,
      generatedAt,
      headers: toPdfHeaders(assignmentPdfColumns, locale),
      rows: buildAssignmentsPdfRows(dedupedRows, locale)
    });
  } else {
    content = buildCsvContent(assignmentColumns, buildAssignmentsRows(dedupedRows));
  }

  return finalizeSessionExport({
    actorAppUserId: input.actorAppUserId,
    session,
    exportType: "assignments",
    format,
    locale,
    generatedAt,
    rowCount: dedupedRows.length,
    duplicateRowsRemoved,
    content
  });
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

  let content: string | Uint8Array;

  if (format === "excel") {
    content = buildExcelContent({
      sheetName: locale === "ar" ? "تقرير الحضور" : "Attendance Export",
      columns: attendanceColumns,
      rows: buildAttendanceRows(dedupedRows, assignmentsById)
    });
  } else if (format === "pdf") {
    content = await createTabularPdf({
      locale,
      title: locale === "ar" ? "تصدير الحضور" : "Attendance Export",
      subtitle:
        locale === "ar"
          ? `الجلسة: ${session.name || session.nameEn || session.id}`
          : `Session: ${session.nameEn || session.name || session.id}`,
      generatedAt,
      headers: toPdfHeaders(attendancePdfColumns, locale),
      rows: buildAttendancePdfRows(dedupedRows, locale)
    });
  } else {
    content = buildCsvContent(
      attendanceColumns,
      buildAttendanceRows(dedupedRows, assignmentsById)
    );
  }

  return finalizeSessionExport({
    actorAppUserId: input.actorAppUserId,
    session,
    exportType: "attendance",
    format,
    locale,
    generatedAt,
    rowCount: dedupedRows.length,
    duplicateRowsRemoved,
    content
  });
}

export async function generateEvaluationsSessionExport(
  input: SessionExportQuery & {
    actorAppUserId: string;
  }
): Promise<SessionExportFileContract> {
  const format = resolveFormat(input.format);
  const locale = resolveLocale(input.locale);
  const session = await assertSessionExists(input.sessionId);
  const generatedAt = new Date();
  const allRows = await collectSessionEvaluations(session.id);
  const { dedupedRows, duplicateRowsRemoved } = dedupeByKey(
    allRows,
    (row) => row.id
  );

  let content: string | Uint8Array;

  if (format === "excel") {
    content = buildExcelContent({
      sheetName: locale === "ar" ? "تقرير التقييمات" : "Evaluations Export",
      columns: evaluationColumns,
      rows: buildEvaluationRows(dedupedRows)
    });
  } else if (format === "pdf") {
    content = await createTabularPdf({
      locale,
      title: locale === "ar" ? "تصدير التقييمات" : "Evaluations Export",
      subtitle:
        locale === "ar"
          ? `الجلسة: ${session.name || session.nameEn || session.id}`
          : `Session: ${session.nameEn || session.name || session.id}`,
      generatedAt,
      headers: toPdfHeaders(evaluationPdfColumns, locale),
      rows: buildEvaluationPdfRows(dedupedRows, locale)
    });
  } else {
    content = buildCsvContent(evaluationColumns, buildEvaluationRows(dedupedRows));
  }

  return finalizeSessionExport({
    actorAppUserId: input.actorAppUserId,
    session,
    exportType: "evaluations",
    format,
    locale,
    generatedAt,
    rowCount: dedupedRows.length,
    duplicateRowsRemoved,
    content
  });
}
