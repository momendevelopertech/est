import { LocaleCode, Prisma, type PrismaClient } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";

import type {
  NotificationPreferenceContract,
  NotificationPreferenceDefaultsContract,
  NotificationPreferenceLanguageContract,
  UpdateNotificationPreferencesPayloadContract
} from "./contracts";
import type { UpdateNotificationPreferencesInput } from "./validation";

type QueryClient = Prisma.TransactionClient | PrismaClient;

const notificationPreferenceDefaultsSettingKeys = {
  emailEnabled: [
    "notification_preferences.default_email_enabled",
    "notifications.default_email_enabled"
  ] as const,
  whatsappEnabled: [
    "notification_preferences.default_whatsapp_enabled",
    "notifications.default_whatsapp_enabled"
  ] as const,
  smsEnabled: [
    "notification_preferences.default_sms_enabled",
    "notifications.default_sms_enabled"
  ] as const,
  inAppEnabled: [
    "notification_preferences.default_in_app_enabled",
    "notifications.default_in_app_enabled"
  ] as const,
  preferredLanguage: [
    "notification_preferences.default_preferred_language",
    "notifications.default_preferred_language"
  ] as const
} as const;

const notificationPreferenceSelect = {
  id: true,
  userId: true,
  emailEnabled: true,
  whatsappEnabled: true,
  smsEnabled: true,
  inAppEnabled: true,
  preferredLanguage: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.NotificationPreferenceSelect;

type NotificationPreferenceRecord = Prisma.NotificationPreferenceGetPayload<{
  select: typeof notificationPreferenceSelect;
}>;

export class NotificationPreferencesServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "NotificationPreferencesServiceError";
  }
}

function isKnownPrismaError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function parseBooleanSettingValue(value: unknown, fallback: boolean) {
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

function parseLocaleSettingValue(
  value: unknown
): NotificationPreferenceLanguageContract {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "ar") {
    return "ar";
  }

  if (normalized === "en") {
    return "en";
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

function toContract(record: NotificationPreferenceRecord): NotificationPreferenceContract {
  return {
    id: record.id,
    userId: record.userId,
    emailEnabled: record.emailEnabled,
    whatsappEnabled: record.whatsappEnabled,
    smsEnabled: record.smsEnabled,
    inAppEnabled: record.inAppEnabled,
    preferredLanguage:
      record.preferredLanguage === LocaleCode.AR
        ? "ar"
        : record.preferredLanguage === LocaleCode.EN
          ? "en"
          : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

async function assertUserExists(client: QueryClient, userId: string) {
  const user = await client.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true
    }
  });

  if (!user) {
    throw new NotificationPreferencesServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found for notification preferences.",
      {
        userId
      }
    );
  }
}

function toLocaleCode(value: NotificationPreferenceLanguageContract): LocaleCode | null {
  if (value === "ar") {
    return LocaleCode.AR;
  }

  if (value === "en") {
    return LocaleCode.EN;
  }

  return null;
}

async function resolveDefaultPreferences(
  client: QueryClient
): Promise<NotificationPreferenceDefaultsContract> {
  const keys = Array.from(
    new Set(
      Object.values(notificationPreferenceDefaultsSettingKeys).flatMap((entry) => [
        ...entry
      ])
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
  const settingMap = new Map(records.map((record) => [record.key, record.value]));

  return {
    emailEnabled: parseBooleanSettingValue(
      resolveFirstSettingValue(
        settingMap,
        notificationPreferenceDefaultsSettingKeys.emailEnabled
      ),
      true
    ),
    whatsappEnabled: parseBooleanSettingValue(
      resolveFirstSettingValue(
        settingMap,
        notificationPreferenceDefaultsSettingKeys.whatsappEnabled
      ),
      true
    ),
    smsEnabled: parseBooleanSettingValue(
      resolveFirstSettingValue(
        settingMap,
        notificationPreferenceDefaultsSettingKeys.smsEnabled
      ),
      false
    ),
    inAppEnabled: parseBooleanSettingValue(
      resolveFirstSettingValue(
        settingMap,
        notificationPreferenceDefaultsSettingKeys.inAppEnabled
      ),
      true
    ),
    preferredLanguage: parseLocaleSettingValue(
      resolveFirstSettingValue(
        settingMap,
        notificationPreferenceDefaultsSettingKeys.preferredLanguage
      )
    )
  };
}

async function findByUserId(client: QueryClient, userId: string) {
  return client.notificationPreference.findUnique({
    where: {
      userId
    },
    select: notificationPreferenceSelect
  });
}

async function ensureNotificationPreferences(
  client: QueryClient,
  userId: string
): Promise<NotificationPreferenceRecord> {
  await assertUserExists(client, userId);

  const existing = await findByUserId(client, userId);

  if (existing) {
    return existing;
  }

  const defaults = await resolveDefaultPreferences(client);

  try {
    return await client.notificationPreference.create({
      data: {
        userId,
        emailEnabled: defaults.emailEnabled,
        whatsappEnabled: defaults.whatsappEnabled,
        smsEnabled: defaults.smsEnabled,
        inAppEnabled: defaults.inAppEnabled,
        preferredLanguage: toLocaleCode(defaults.preferredLanguage)
      },
      select: notificationPreferenceSelect
    });
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      const concurrentRecord = await findByUserId(client, userId);

      if (concurrentRecord) {
        return concurrentRecord;
      }
    }

    throw error;
  }
}

function toUpdateData(input: UpdateNotificationPreferencesPayloadContract) {
  return {
    ...(input.emailEnabled !== undefined
      ? {
          emailEnabled: input.emailEnabled
        }
      : {}),
    ...(input.whatsappEnabled !== undefined
      ? {
          whatsappEnabled: input.whatsappEnabled
        }
      : {}),
    ...(input.smsEnabled !== undefined
      ? {
          smsEnabled: input.smsEnabled
        }
      : {}),
    ...(input.inAppEnabled !== undefined
      ? {
          inAppEnabled: input.inAppEnabled
        }
      : {}),
    ...(input.preferredLanguage !== undefined
      ? {
          preferredLanguage: toLocaleCode(input.preferredLanguage)
        }
      : {})
  } satisfies Prisma.NotificationPreferenceUpdateInput;
}

export async function getUserPreferences(
  userId: string,
  options: {
    client?: QueryClient;
  } = {}
): Promise<NotificationPreferenceContract> {
  const client = options.client ?? db;
  const record = await ensureNotificationPreferences(client, userId);

  return toContract(record);
}

export async function updateUserPreferences(
  userId: string,
  payload: UpdateNotificationPreferencesInput,
  options: {
    actorAppUserId: string;
  }
): Promise<NotificationPreferenceContract> {
  return db.$transaction(async (tx) => {
    const before = await ensureNotificationPreferences(tx, userId);
    const updated = await tx.notificationPreference.update({
      where: {
        userId
      },
      data: toUpdateData(payload),
      select: notificationPreferenceSelect
    });

    await logActivity({
      client: tx,
      userId: options.actorAppUserId,
      action: "notification_preferences_updated",
      entityType: "notification_preferences",
      entityId: updated.id,
      description: `Updated notification preferences for user ${userId}.`,
      metadata: {
        userId,
        emailEnabled: updated.emailEnabled,
        whatsappEnabled: updated.whatsappEnabled,
        smsEnabled: updated.smsEnabled,
        inAppEnabled: updated.inAppEnabled,
        preferredLanguage:
          updated.preferredLanguage === LocaleCode.AR
            ? "ar"
            : updated.preferredLanguage === LocaleCode.EN
              ? "en"
              : null
      },
      beforePayload: before,
      afterPayload: updated
    });

    return toContract(updated);
  });
}
