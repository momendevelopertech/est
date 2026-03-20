import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { reportNotificationFailure } from "@/lib/monitoring/service";

import type {
  SendWhatsAppMessageResultContract,
  WhatsAppConfigSummaryContract,
  WhatsAppMessagePayloadContract,
  WhatsAppResolvedSettingsContract,
  WhatsAppSendResultContract,
  WhatsAppTestMessageResultContract
} from "./contracts";
import { sendWhatsAppMessagePayloadSchema, whatsappTestMessageSchema } from "./validation";
import {
  normalizeWhatsAppProviderKey,
  resolveWhatsAppProviderAdapter
} from "./whatsappProvider";

type QueryClient = Prisma.TransactionClient | PrismaClient;

const whatsappSettingKeys = {
  enabled: ["whatsapp_enabled", "notifications.whatsapp_enabled"] as const,
  provider: ["whatsapp_provider", "notifications.whatsapp_provider"] as const,
  apiKey: [
    "whatsapp_api_key",
    "whatsapp_token",
    "whatsapp_api_token",
    "notifications.whatsapp_token",
    "notifications.whatsapp_api_key",
    "notifications.whatsapp_api_token"
  ] as const,
  senderId: ["whatsapp_sender_id", "notifications.whatsapp_sender_id"] as const,
  accountSid: ["whatsapp_account_sid", "notifications.whatsapp_account_sid"] as const,
  apiBaseUrl: ["whatsapp_api_base_url", "notifications.whatsapp_api_base_url"] as const
} as const;

const placeholderSyntaxPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
const validPhonePattern = /^\+[1-9]\d{6,18}$/;

export class WhatsAppNotificationsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "WhatsAppNotificationsServiceError";
  }
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function parseMetadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readMetadataString(
  metadata: Record<string, unknown> | null,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseBooleanSettingValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on" ||
      normalized === "enabled"
    ) {
      return true;
    }

    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no" ||
      normalized === "off" ||
      normalized === "disabled"
    ) {
      return false;
    }
  }

  return fallback;
}

function parseStringSettingValue(value: unknown) {
  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function resolveFirstSettingValue(
  settingsMap: Map<string, unknown>,
  keys: readonly string[]
) {
  for (const key of keys) {
    if (settingsMap.has(key)) {
      return settingsMap.get(key);
    }
  }

  return undefined;
}

function normalizePhoneNumberForWhatsApp(phoneNumber: string | null) {
  const normalized = normalizeOptionalString(phoneNumber);

  if (!normalized) {
    return null;
  }

  let cleaned = normalized.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = `+${cleaned.slice(2)}`;
  } else if (!cleaned.startsWith("+") && /^\d+$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }

  return cleaned;
}

function renderTemplateText(
  templateText: string,
  variables: Record<string, string | number | boolean | null>
) {
  return templateText.replace(
    new RegExp(placeholderSyntaxPattern.source, "g"),
    (_fullMatch, rawVariable: string) => {
      const variable = rawVariable.trim();
      const value = variables[variable];

      if (value === undefined || value === null) {
        return "";
      }

      return String(value);
    }
  );
}

function formatMessageText(input: {
  locale: "en" | "ar";
  title: {
    en: string;
    ar: string;
  };
  body: {
    en: string;
    ar: string;
  };
  variables: Record<string, string | number | boolean | null>;
}) {
  const titleTemplate = input.locale === "ar" ? input.title.ar : input.title.en;
  const bodyTemplate = input.locale === "ar" ? input.body.ar : input.body.en;
  const title = renderTemplateText(titleTemplate, input.variables).trim();
  const body = renderTemplateText(bodyTemplate, input.variables).trim();

  if (title && body) {
    return `${title}\n${body}`;
  }

  return title || body;
}

function buildSkippedResult(input: {
  reason: "disabled" | "phone_missing" | "phone_invalid";
  attemptedAt: Date;
  provider: string | null;
  payload: ReturnType<typeof sendWhatsAppMessagePayloadSchema.parse>;
  normalizedPhone: string | null;
  message: string;
}): WhatsAppSendResultContract {
  return {
    status: "skipped",
    reason: input.reason,
    provider: input.provider,
    recipientUserId: input.payload.recipientUserId ?? null,
    recipientPhone: input.payload.phoneNumber,
    normalizedPhone: input.normalizedPhone,
    locale: input.payload.locale,
    message: input.message,
    messageLength: input.message.length,
    externalMessageId: null,
    statusCode: null,
    providerStatus: null,
    error: null,
    metadata: parseMetadataRecord(input.payload.metadata),
    sentAt: null,
    attemptedAt: input.attemptedAt
  };
}

function buildFailedResult(input: {
  reason: "config_missing" | "provider_unsupported" | "provider_failed";
  attemptedAt: Date;
  provider: string | null;
  payload: ReturnType<typeof sendWhatsAppMessagePayloadSchema.parse>;
  normalizedPhone: string | null;
  message: string;
  statusCode?: number | null;
  providerStatus?: string | null;
  externalMessageId?: string | null;
  error: string;
}): WhatsAppSendResultContract {
  return {
    status: "failed",
    reason: input.reason,
    provider: input.provider,
    recipientUserId: input.payload.recipientUserId ?? null,
    recipientPhone: input.payload.phoneNumber,
    normalizedPhone: input.normalizedPhone,
    locale: input.payload.locale,
    message: input.message,
    messageLength: input.message.length,
    externalMessageId: input.externalMessageId ?? null,
    statusCode: input.statusCode ?? null,
    providerStatus: input.providerStatus ?? null,
    error: input.error,
    metadata: parseMetadataRecord(input.payload.metadata),
    sentAt: null,
    attemptedAt: input.attemptedAt
  };
}

function buildSentResult(input: {
  attemptedAt: Date;
  provider: string;
  payload: ReturnType<typeof sendWhatsAppMessagePayloadSchema.parse>;
  normalizedPhone: string;
  message: string;
  statusCode: number | null;
  providerStatus: string | null;
  externalMessageId: string | null;
}): WhatsAppSendResultContract {
  const sentAt = new Date();

  return {
    status: "sent",
    reason: null,
    provider: input.provider,
    recipientUserId: input.payload.recipientUserId ?? null,
    recipientPhone: input.payload.phoneNumber,
    normalizedPhone: input.normalizedPhone,
    locale: input.payload.locale,
    message: input.message,
    messageLength: input.message.length,
    externalMessageId: input.externalMessageId,
    statusCode: input.statusCode,
    providerStatus: input.providerStatus,
    error: null,
    metadata: parseMetadataRecord(input.payload.metadata),
    sentAt,
    attemptedAt: input.attemptedAt
  };
}

async function logWhatsAppResult(
  client: QueryClient,
  input: {
    actorAppUserId?: string;
    result: WhatsAppSendResultContract;
  }
) {
  const action =
    input.result.status === "sent" ? "whatsapp_sent" : "whatsapp_failed";

  try {
    await logActivity({
      client,
      userId: input.actorAppUserId ?? null,
      action,
      entityType: "notification_whatsapp",
      entityId:
        input.result.externalMessageId ??
        input.result.recipientUserId ??
        randomUUID(),
      description:
        action === "whatsapp_sent"
          ? `Sent WhatsApp notification via ${input.result.provider ?? "unknown provider"}.`
          : `Failed to send WhatsApp notification via ${
              input.result.provider ?? "unknown provider"
            }.`,
      metadata: {
        provider: input.result.provider,
        status: input.result.status,
        reason: input.result.reason,
        recipientUserId: input.result.recipientUserId,
        recipientPhone: input.result.normalizedPhone ?? input.result.recipientPhone,
        statusCode: input.result.statusCode,
        providerStatus: input.result.providerStatus,
        error: input.result.error
      },
      afterPayload: input.result
    });

    if (input.result.status === "failed") {
      const metadata = parseMetadataRecord(input.result.metadata);

      await reportNotificationFailure({
        channel: "whatsapp",
        provider: input.result.provider,
        reason: input.result.reason ?? "provider_failed",
        statusCode: input.result.statusCode,
        error: input.result.error ?? "WhatsApp delivery failed.",
        recipientUserId: input.result.recipientUserId,
        sourceEntityType: readMetadataString(metadata, "sourceEntityType"),
        sourceEntityId: readMetadataString(metadata, "sourceEntityId"),
        eventType: readMetadataString(metadata, "eventType"),
        actorAppUserId: input.actorAppUserId ?? null,
        client
      });
    }
  } catch (error) {
    console.error("whatsapp_activity_log_failed", error);
  }
}

function toConfigSummary(
  settings: WhatsAppResolvedSettingsContract
): WhatsAppConfigSummaryContract {
  return {
    enabled: settings.enabled,
    provider: normalizeWhatsAppProviderKey(settings.provider),
    apiKeyConfigured: Boolean(normalizeOptionalString(settings.apiKey)),
    senderIdConfigured: Boolean(normalizeOptionalString(settings.senderId)),
    accountSidConfigured: Boolean(normalizeOptionalString(settings.accountSid))
  };
}

export async function getWhatsAppDeliverySettings(
  options: {
    client?: QueryClient;
  } = {}
): Promise<WhatsAppResolvedSettingsContract> {
  const client = options.client ?? db;
  const keys = Array.from(
    new Set(
      Object.values(whatsappSettingKeys).flatMap((entry) => [...entry])
    )
  );
  const records = await client.setting.findMany({
    where: {
      key: {
        in: keys
      },
      isActive: true
    },
    select: {
      key: true,
      value: true
    }
  });
  const settingsMap = new Map(records.map((record) => [record.key, record.value]));

  return {
    enabled: parseBooleanSettingValue(
      resolveFirstSettingValue(settingsMap, whatsappSettingKeys.enabled),
      false
    ),
    provider: parseStringSettingValue(
      resolveFirstSettingValue(settingsMap, whatsappSettingKeys.provider)
    ),
    apiKey: parseStringSettingValue(
      resolveFirstSettingValue(settingsMap, whatsappSettingKeys.apiKey)
    ),
    senderId: parseStringSettingValue(
      resolveFirstSettingValue(settingsMap, whatsappSettingKeys.senderId)
    ),
    accountSid: parseStringSettingValue(
      resolveFirstSettingValue(settingsMap, whatsappSettingKeys.accountSid)
    ),
    apiBaseUrl: parseStringSettingValue(
      resolveFirstSettingValue(settingsMap, whatsappSettingKeys.apiBaseUrl)
    )
  };
}

export async function sendWhatsAppMessage(
  payload: WhatsAppMessagePayloadContract,
  options: {
    actorAppUserId?: string;
    client?: QueryClient;
    settings?: WhatsAppResolvedSettingsContract;
  } = {}
): Promise<SendWhatsAppMessageResultContract> {
  const parsedPayload = sendWhatsAppMessagePayloadSchema.parse(payload);
  const attemptedAt = new Date();
  const client = options.client ?? db;
  const settings =
    options.settings ?? (await getWhatsAppDeliverySettings({ client }));
  const normalizedProvider = normalizeWhatsAppProviderKey(settings.provider);
  const normalizedApiKey = normalizeOptionalString(settings.apiKey);
  const normalizedSenderId = normalizeOptionalString(settings.senderId);
  const normalizedPhone = normalizePhoneNumberForWhatsApp(parsedPayload.phoneNumber);
  const variables = parsedPayload.variables ?? {};
  const message = formatMessageText({
    locale: parsedPayload.locale,
    title: parsedPayload.title,
    body: parsedPayload.body,
    variables
  });

  if (!settings.enabled) {
    return buildSkippedResult({
      reason: "disabled",
      attemptedAt,
      provider: normalizedProvider,
      payload: parsedPayload,
      normalizedPhone,
      message
    });
  }

  if (!normalizedPhone) {
    return buildSkippedResult({
      reason: "phone_missing",
      attemptedAt,
      provider: normalizedProvider,
      payload: parsedPayload,
      normalizedPhone,
      message
    });
  }

  if (!validPhonePattern.test(normalizedPhone)) {
    const invalidPhoneResult = buildSkippedResult({
      reason: "phone_invalid",
      attemptedAt,
      provider: normalizedProvider,
      payload: parsedPayload,
      normalizedPhone,
      message
    });

    await logWhatsAppResult(client, {
      actorAppUserId: options.actorAppUserId,
      result: invalidPhoneResult
    });

    return invalidPhoneResult;
  }

  if (!normalizedProvider || !normalizedApiKey || !normalizedSenderId) {
    const failedResult = buildFailedResult({
      reason: "config_missing",
      attemptedAt,
      provider: normalizedProvider,
      payload: parsedPayload,
      normalizedPhone,
      message,
      error: "WhatsApp configuration is missing provider, api key/token, or sender ID."
    });

    await logWhatsAppResult(client, {
      actorAppUserId: options.actorAppUserId,
      result: failedResult
    });

    return failedResult;
  }

  const adapter = resolveWhatsAppProviderAdapter(normalizedProvider);

  if (!adapter) {
    const unsupportedProviderResult = buildFailedResult({
      reason: "provider_unsupported",
      attemptedAt,
      provider: normalizedProvider,
      payload: parsedPayload,
      normalizedPhone,
      message,
      error: `WhatsApp provider "${normalizedProvider}" is not supported.`
    });

    await logWhatsAppResult(client, {
      actorAppUserId: options.actorAppUserId,
      result: unsupportedProviderResult
    });

    return unsupportedProviderResult;
  }

  const providerResult = await adapter.sendMessage(
    {
      to: normalizedPhone,
      from: normalizedSenderId,
      locale: parsedPayload.locale,
      message,
      metadata: parseMetadataRecord(parsedPayload.metadata)
    },
    {
      provider: normalizedProvider,
      apiKey: normalizedApiKey,
      senderId: normalizedSenderId,
      accountSid: settings.accountSid,
      apiBaseUrl: settings.apiBaseUrl
    }
  );

  if (!providerResult.ok) {
    const failedResult = buildFailedResult({
      reason: "provider_failed",
      attemptedAt,
      provider: normalizedProvider,
      payload: parsedPayload,
      normalizedPhone,
      message,
      statusCode: providerResult.statusCode,
      providerStatus: providerResult.providerStatus,
      externalMessageId: providerResult.externalMessageId,
      error: providerResult.error ?? "WhatsApp provider call failed."
    });

    await logWhatsAppResult(client, {
      actorAppUserId: options.actorAppUserId,
      result: failedResult
    });

    return failedResult;
  }

  const sentResult = buildSentResult({
    attemptedAt,
    provider: normalizedProvider,
    payload: parsedPayload,
    normalizedPhone,
    message,
    statusCode: providerResult.statusCode,
    providerStatus: providerResult.providerStatus,
    externalMessageId: providerResult.externalMessageId
  });

  await logWhatsAppResult(client, {
    actorAppUserId: options.actorAppUserId,
    result: sentResult
  });

  return sentResult;
}

export async function sendWhatsAppTestMessage(
  input: unknown,
  options: {
    actorAppUserId: string;
    client?: QueryClient;
  }
): Promise<WhatsAppTestMessageResultContract> {
  const parsedInput = whatsappTestMessageSchema.parse(input);
  const client = options.client ?? db;
  const settings = await getWhatsAppDeliverySettings({
    client
  });
  const defaultTitle = {
    en: "ExamOps WhatsApp test",
    ar: "\u0627\u062e\u062a\u0628\u0627\u0631 \u0648\u0627\u062a\u0633\u0627\u0628 ExamOps"
  };
  const defaultBody = {
    en: "This is a connectivity test for WhatsApp notifications.",
    ar: "\u0647\u0630\u0627 \u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u062a\u0635\u0627\u0644 \u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0648\u0627\u062a\u0633\u0627\u0628."
  };
  const result = await sendWhatsAppMessage(
    {
      type: parsedInput.type,
      recipientUserId: null,
      phoneNumber: parsedInput.phoneNumber,
      locale: parsedInput.locale,
      title: parsedInput.title ?? defaultTitle,
      body: parsedInput.body ?? defaultBody,
      variables: parsedInput.variables,
      metadata: {
        ...(parseMetadataRecord(parsedInput.metadata) ?? {}),
        source: "api_whatsapp_test"
      }
    },
    {
      actorAppUserId: options.actorAppUserId,
      client,
      settings
    }
  );

  return {
    config: toConfigSummary(settings),
    delivery: result
  };
}

export function assertWhatsAppConfigEnabled(
  settings: WhatsAppResolvedSettingsContract
) {
  if (!settings.enabled) {
    throw new WhatsAppNotificationsServiceError(
      ERROR_CODES.whatsappNotConfigured,
      409,
      "WhatsApp delivery is disabled in settings."
    );
  }
}
