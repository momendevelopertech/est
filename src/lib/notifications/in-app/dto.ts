import { serializeForApi } from "@/lib/dto/serialize";

import type {
  InAppNotificationContract,
  InAppNotificationListResultContract,
  MarkAllAsReadResultContract
} from "./contracts";

export function toInAppNotificationDTO(value: InAppNotificationContract) {
  return serializeForApi(value);
}

export function toInAppNotificationListDTO(
  value: InAppNotificationListResultContract
) {
  return serializeForApi(value);
}

export function toMarkAllInAppNotificationsReadDTO(
  value: MarkAllAsReadResultContract
) {
  return serializeForApi(value);
}
