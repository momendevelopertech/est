export const sessionExportTypes = [
  "assignments",
  "attendance",
  "evaluations"
] as const;
export type SessionExportType = (typeof sessionExportTypes)[number];

export const sessionExportFormats = ["csv", "excel", "pdf"] as const;
export type SessionExportFormat = (typeof sessionExportFormats)[number];

export type SessionExportLocale = "en" | "ar";

export type SessionExportQueryContract = {
  sessionId: string;
  format: SessionExportFormat;
  locale: SessionExportLocale;
};

export type SessionExportFileContract = {
  exportType: SessionExportType;
  sessionId: string;
  format: SessionExportFormat;
  locale: SessionExportLocale;
  fileName: string;
  contentType: string;
  content: string | Uint8Array;
  generatedAt: Date;
  rowCount: number;
  duplicateRowsRemoved: number;
};
