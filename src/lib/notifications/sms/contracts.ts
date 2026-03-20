export const smsProviderKeys = ["twilio", "mock_sms_cloud"] as const;

export type SmsProviderKey = (typeof smsProviderKeys)[number];

export type SmsLocalizedTextContract = {
  en: string;
  ar: string;
};

export type SmsTemplateVariablesContract = Record<
  string,
  string | number | boolean | null
>;

export type SmsMetadataContract = Record<string, unknown> | null;

export type SmsMessagePayloadContract = {
  type: string;
  recipientUserId?: string | null;
  phoneNumber: string | null;
  locale: "en" | "ar";
  title: SmsLocalizedTextContract;
  body: SmsLocalizedTextContract;
  variables?: SmsTemplateVariablesContract;
  metadata?: SmsMetadataContract;
};

export type SmsResolvedSettingsContract = {
  enabled: boolean;
  provider: string | null;
  apiKey: string | null;
  senderId: string | null;
  accountSid: string | null;
  apiBaseUrl: string | null;
};

export type SmsProviderRuntimeConfigContract = {
  provider: string;
  apiKey: string;
  senderId: string;
  accountSid?: string | null;
  apiBaseUrl?: string | null;
};

export type SmsProviderSendInputContract = {
  to: string;
  from: string;
  locale: "en" | "ar";
  message: string;
  metadata: SmsMetadataContract;
};

export type SmsProviderSendResultContract = {
  ok: boolean;
  provider: string;
  externalMessageId: string | null;
  statusCode: number | null;
  providerStatus: string | null;
  response: Record<string, unknown> | null;
  error: string | null;
};

export type SmsSendFailureReasonContract =
  | "disabled"
  | "phone_missing"
  | "phone_invalid"
  | "config_missing"
  | "provider_unsupported"
  | "provider_failed";

export type SmsSendResultContract = {
  status: "sent" | "failed" | "skipped";
  reason: SmsSendFailureReasonContract | null;
  provider: string | null;
  recipientUserId: string | null;
  recipientPhone: string | null;
  normalizedPhone: string | null;
  locale: "en" | "ar";
  message: string;
  messageLength: number;
  externalMessageId: string | null;
  statusCode: number | null;
  providerStatus: string | null;
  providerResponse: Record<string, unknown> | null;
  error: string | null;
  metadata: SmsMetadataContract;
  sentAt: Date | null;
  attemptedAt: Date;
};

export type SendSmsResultContract = SmsSendResultContract;

export type SmsConfigSummaryContract = {
  enabled: boolean;
  provider: string | null;
  apiKeyConfigured: boolean;
  senderIdConfigured: boolean;
  accountSidConfigured: boolean;
};

export type SmsTestMessageResultContract = {
  config: SmsConfigSummaryContract;
  delivery: SmsSendResultContract;
};
