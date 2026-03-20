export const whatsappProviderKeys = [
  "twilio",
  "meta_whatsapp_cloud"
] as const;

export type WhatsAppProviderKey = (typeof whatsappProviderKeys)[number];

export type WhatsAppLocalizedTextContract = {
  en: string;
  ar: string;
};

export type WhatsAppTemplateVariablesContract = Record<
  string,
  string | number | boolean | null
>;

export type WhatsAppMetadataContract = Record<string, unknown> | null;

export type WhatsAppMessagePayloadContract = {
  type: string;
  recipientUserId?: string | null;
  phoneNumber: string | null;
  locale: "en" | "ar";
  title: WhatsAppLocalizedTextContract;
  body: WhatsAppLocalizedTextContract;
  variables?: WhatsAppTemplateVariablesContract;
  metadata?: WhatsAppMetadataContract;
};

export type WhatsAppResolvedSettingsContract = {
  enabled: boolean;
  provider: string | null;
  apiKey: string | null;
  senderId: string | null;
  accountSid: string | null;
  apiBaseUrl: string | null;
};

export type WhatsAppProviderRuntimeConfigContract = {
  provider: string;
  apiKey: string;
  senderId: string;
  accountSid?: string | null;
  apiBaseUrl?: string | null;
};

export type WhatsAppProviderSendInputContract = {
  to: string;
  from: string;
  locale: "en" | "ar";
  message: string;
  metadata: WhatsAppMetadataContract;
};

export type WhatsAppProviderSendResultContract = {
  ok: boolean;
  provider: string;
  externalMessageId: string | null;
  statusCode: number | null;
  providerStatus: string | null;
  response: Record<string, unknown> | null;
  error: string | null;
};

export type WhatsAppSendFailureReasonContract =
  | "disabled"
  | "phone_missing"
  | "phone_invalid"
  | "config_missing"
  | "provider_unsupported"
  | "provider_failed";

export type WhatsAppSendResultContract = {
  status: "sent" | "failed" | "skipped";
  reason: WhatsAppSendFailureReasonContract | null;
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
  error: string | null;
  metadata: WhatsAppMetadataContract;
  sentAt: Date | null;
  attemptedAt: Date;
};

export type SendWhatsAppMessageResultContract = WhatsAppSendResultContract;

export type WhatsAppConfigSummaryContract = {
  enabled: boolean;
  provider: string | null;
  apiKeyConfigured: boolean;
  senderIdConfigured: boolean;
  accountSidConfigured: boolean;
};

export type WhatsAppTestMessageResultContract = {
  config: WhatsAppConfigSummaryContract;
  delivery: WhatsAppSendResultContract;
};
