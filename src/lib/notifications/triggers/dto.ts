import { serializeForApi } from "@/lib/dto/serialize";

import type { NotificationTriggerExecutionResultContract } from "./contracts";

export function toNotificationTriggerExecutionDTO(
  value: NotificationTriggerExecutionResultContract
) {
  return serializeForApi(value);
}
