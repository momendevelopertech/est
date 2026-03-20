import { serializeForApi } from "@/lib/dto/serialize";

import type { ReportSummaryContract } from "./contracts";

export function toReportSummaryDTO(value: ReportSummaryContract) {
  return serializeForApi(value);
}
