import { serializeForApi } from "@/lib/dto/serialize";

import type {
  NotificationEmailPreviewResultContract,
  NotificationEmailTemplateContract,
  NotificationEmailTemplateListContract,
  UpsertNotificationEmailTemplateResultContract
} from "./contracts";

export function toNotificationEmailTemplateListDTO(
  value: NotificationEmailTemplateListContract
) {
  return serializeForApi(value);
}

export function toNotificationEmailTemplateDTO(
  value: NotificationEmailTemplateContract
) {
  return serializeForApi(value);
}

export function toUpsertNotificationEmailTemplateDTO(
  value: UpsertNotificationEmailTemplateResultContract
) {
  return serializeForApi(value);
}

export function toNotificationEmailPreviewDTO(
  value: NotificationEmailPreviewResultContract
) {
  return serializeForApi(value);
}
