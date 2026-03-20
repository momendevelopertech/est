import { serializeForApi } from "@/lib/dto/serialize";

import type {
  ImportTemplateDownloadResultContract,
  ImportTemplateListContract
} from "./contracts";

export function toImportTemplateListDTO(value: ImportTemplateListContract) {
  return serializeForApi(value);
}

export function toImportTemplateDownloadDTO(
  value: ImportTemplateDownloadResultContract
) {
  return serializeForApi(value);
}
