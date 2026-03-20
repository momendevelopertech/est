import { serializeForApi } from "@/lib/dto/serialize";

import type {
  SendSmsResultContract,
  SmsTestMessageResultContract
} from "./contracts";

export function toSendSmsResultDTO(value: SendSmsResultContract) {
  return serializeForApi(value);
}

export function toSmsTestMessageResultDTO(value: SmsTestMessageResultContract) {
  return serializeForApi(value);
}
