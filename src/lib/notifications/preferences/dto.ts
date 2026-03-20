import { serializeForApi } from "@/lib/dto/serialize";

import type { NotificationPreferenceContract } from "./contracts";

export function toNotificationPreferenceDTO(value: NotificationPreferenceContract) {
  return serializeForApi(value);
}
