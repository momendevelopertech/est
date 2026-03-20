import { serializeForApi } from "@/lib/dto/serialize";

import type {
  SendWhatsAppMessageResultContract,
  WhatsAppTestMessageResultContract
} from "./contracts";

export function toSendWhatsAppMessageResultDTO(
  value: SendWhatsAppMessageResultContract
) {
  return serializeForApi(value);
}

export function toWhatsAppTestMessageResultDTO(
  value: WhatsAppTestMessageResultContract
) {
  return serializeForApi(value);
}
