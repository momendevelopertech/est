import { serializeForApi } from "@/lib/dto/serialize";

import type { SessionExportFileContract } from "./contracts";

export function toSessionExportFileDTO(value: SessionExportFileContract) {
  return serializeForApi(value);
}
