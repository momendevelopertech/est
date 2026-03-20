import type { MetricsFiltersContract } from "@/lib/metrics/contracts";

export const reportTypes = ["assignments", "attendance", "evaluations"] as const;
export type ReportType = (typeof reportTypes)[number];

export type ReportMetricCardContract = {
  key: string;
  value: number;
  labelEn: string;
  labelAr: string;
  format?: "number" | "decimal" | "percent";
};

export type ReportBreakdownItemContract = {
  key: string;
  count: number;
  labelEn: string;
  labelAr: string;
};

export type ReportBreakdownSectionContract = {
  key: string;
  titleEn: string;
  titleAr: string;
  items: ReportBreakdownItemContract[];
};

export type ReportSummaryContract = {
  reportType: ReportType;
  generatedAt: Date;
  filters: MetricsFiltersContract;
  cards: ReportMetricCardContract[];
  breakdowns: ReportBreakdownSectionContract[];
  exportUrl: string | null;
};
