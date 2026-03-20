import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";

type QueryClient = Prisma.TransactionClient | PrismaClient;

type MonitoringThresholds = {
  apiErrorThreshold: number;
  apiErrorWindowMinutes: number;
  notificationFailureThreshold: number;
  notificationFailureWindowMinutes: number;
};

type ApiErrorInput = {
  scope: string;
  error: unknown;
  route?: string | null;
  method?: string | null;
  requestId?: string | null;
  actorAppUserId?: string | null;
  client?: QueryClient;
};

type NotificationFailureInput = {
  channel: "email" | "whatsapp" | "sms";
  reason: string;
  error?: unknown;
  provider?: string | null;
  statusCode?: number | null;
  recipientUserId?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  eventType?: string | null;
  actorAppUserId?: string | null;
  client?: QueryClient;
};

const monitoringSettingKeys = {
  apiErrorThreshold: [
    "monitoring.api_error_alert_threshold",
    "monitoring.api_error_threshold"
  ] as const,
  apiErrorWindowMinutes: [
    "monitoring.api_error_alert_window_minutes",
    "monitoring.api_error_window_minutes"
  ] as const,
  notificationFailureThreshold: [
    "monitoring.notification_failure_alert_threshold",
    "monitoring.notification_failure_threshold"
  ] as const,
  notificationFailureWindowMinutes: [
    "monitoring.notification_failure_alert_window_minutes",
    "monitoring.notification_failure_window_minutes"
  ] as const
} as const;

const defaultThresholds: MonitoringThresholds = {
  apiErrorThreshold: 5,
  apiErrorWindowMinutes: 5,
  notificationFailureThreshold: 5,
  notificationFailureWindowMinutes: 10
};

function parseNumberSetting(
  value: unknown,
  fallback: number,
  options: {
    min: number;
    max: number;
  }
) {
  let numeric: number | null = null;

  if (typeof value === "number" && Number.isFinite(value)) {
    numeric = value;
  } else if (typeof value === "string") {
    const parsed = Number(value.trim());
    numeric = Number.isFinite(parsed) ? parsed : null;
  } else if (typeof value === "boolean") {
    numeric = value ? 1 : 0;
  }

  if (numeric === null) {
    return fallback;
  }

  const rounded = Math.round(numeric);
  if (rounded < options.min || rounded > options.max) {
    return fallback;
  }

  return rounded;
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

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Unknown error.";
}

function extractErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" && code.trim().length > 0 ? code : null;
}

function extractStatusCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const status = (error as Record<string, unknown>).status;

  if (typeof status !== "number" || !Number.isFinite(status)) {
    return null;
  }

  return Math.trunc(status);
}

function extractErrorStack(error: unknown) {
  if (!(error instanceof Error) || !error.stack) {
    return null;
  }

  return error.stack.split("\n").slice(0, 8).join("\n");
}

function toIsoTimestamp(value: Date) {
  return value.toISOString();
}

async function getMonitoringThresholds(client: QueryClient) {
  const keys = Array.from(
    new Set(
      Object.values(monitoringSettingKeys).flatMap((entry) => [...entry])
    )
  );

  const settings = await client.setting.findMany({
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

  const settingsMap = new Map(
    settings.map((setting) => [setting.key, setting.value])
  );

  return {
    apiErrorThreshold: parseNumberSetting(
      resolveFirstSettingValue(
        settingsMap,
        monitoringSettingKeys.apiErrorThreshold
      ),
      defaultThresholds.apiErrorThreshold,
      {
        min: 1,
        max: 1000
      }
    ),
    apiErrorWindowMinutes: parseNumberSetting(
      resolveFirstSettingValue(
        settingsMap,
        monitoringSettingKeys.apiErrorWindowMinutes
      ),
      defaultThresholds.apiErrorWindowMinutes,
      {
        min: 1,
        max: 240
      }
    ),
    notificationFailureThreshold: parseNumberSetting(
      resolveFirstSettingValue(
        settingsMap,
        monitoringSettingKeys.notificationFailureThreshold
      ),
      defaultThresholds.notificationFailureThreshold,
      {
        min: 1,
        max: 1000
      }
    ),
    notificationFailureWindowMinutes: parseNumberSetting(
      resolveFirstSettingValue(
        settingsMap,
        monitoringSettingKeys.notificationFailureWindowMinutes
      ),
      defaultThresholds.notificationFailureWindowMinutes,
      {
        min: 1,
        max: 240
      }
    )
  } satisfies MonitoringThresholds;
}

async function emitMonitoringAlert(
  client: QueryClient,
  input: {
    alertType: "api_error_rate" | "notification_failure_rate";
    threshold: number;
    observedCount: number;
    windowMinutes: number;
    triggeredAt: Date;
    metadata: Record<string, unknown>;
  }
) {
  const alertEntityId =
    input.alertType === "api_error_rate"
      ? "api_error_rate_threshold"
      : "notification_failure_rate_threshold";
  const windowStart = new Date(
    input.triggeredAt.getTime() - input.windowMinutes * 60 * 1000
  );

  const existingAlert = await client.activityLog.findFirst({
    where: {
      action: "monitoring_alert",
      entityType: "monitoring",
      entityId: alertEntityId,
      occurredAt: {
        gte: windowStart
      }
    },
    select: {
      id: true
    }
  });

  if (existingAlert) {
    return;
  }

  const payload = {
    alertType: input.alertType,
    threshold: input.threshold,
    observedCount: input.observedCount,
    windowMinutes: input.windowMinutes,
    triggeredAt: toIsoTimestamp(input.triggeredAt),
    ...input.metadata
  };

  console.error("monitoring_alert", payload);

  await logActivity({
    client,
    action: "monitoring_alert",
    entityType: "monitoring",
    entityId: alertEntityId,
    description: `Monitoring alert raised for ${input.alertType}.`,
    metadata: payload
  });
}

async function evaluateApiErrorThreshold(
  client: QueryClient,
  input: {
    scope: string;
    occurredAt: Date;
    thresholds: MonitoringThresholds;
  }
) {
  const windowStart = new Date(
    input.occurredAt.getTime() - input.thresholds.apiErrorWindowMinutes * 60 * 1000
  );

  const errorCount = await client.activityLog.count({
    where: {
      action: "api_error",
      entityType: "api_error",
      occurredAt: {
        gte: windowStart
      }
    }
  });

  if (errorCount < input.thresholds.apiErrorThreshold) {
    return;
  }

  await emitMonitoringAlert(client, {
    alertType: "api_error_rate",
    threshold: input.thresholds.apiErrorThreshold,
    observedCount: errorCount,
    windowMinutes: input.thresholds.apiErrorWindowMinutes,
    triggeredAt: input.occurredAt,
    metadata: {
      scope: input.scope
    }
  });
}

async function evaluateNotificationFailureThreshold(
  client: QueryClient,
  input: {
    channel: NotificationFailureInput["channel"];
    occurredAt: Date;
    thresholds: MonitoringThresholds;
  }
) {
  const windowStart = new Date(
    input.occurredAt.getTime() -
      input.thresholds.notificationFailureWindowMinutes * 60 * 1000
  );

  const failureCount = await client.activityLog.count({
    where: {
      action: "notification_delivery_failed",
      entityType: "notification_delivery",
      occurredAt: {
        gte: windowStart
      }
    }
  });

  if (failureCount < input.thresholds.notificationFailureThreshold) {
    return;
  }

  await emitMonitoringAlert(client, {
    alertType: "notification_failure_rate",
    threshold: input.thresholds.notificationFailureThreshold,
    observedCount: failureCount,
    windowMinutes: input.thresholds.notificationFailureWindowMinutes,
    triggeredAt: input.occurredAt,
    metadata: {
      channel: input.channel
    }
  });
}

export async function reportApiError(input: ApiErrorInput) {
  const client = input.client ?? db;
  const occurredAt = new Date();

  try {
    const payload = {
      scope: input.scope,
      route: input.route ?? null,
      method: input.method ?? null,
      requestId: input.requestId ?? null,
      code: extractErrorCode(input.error),
      status: extractStatusCode(input.error),
      message: extractErrorMessage(input.error),
      stack: extractErrorStack(input.error),
      occurredAt: toIsoTimestamp(occurredAt)
    };

    console.error("monitoring_api_error", payload);

    await logActivity({
      client,
      userId: input.actorAppUserId ?? null,
      action: "api_error",
      entityType: "api_error",
      entityId: randomUUID(),
      description: `API error captured in ${input.scope}.`,
      metadata: payload
    });

    const thresholds = await getMonitoringThresholds(client);
    await evaluateApiErrorThreshold(client, {
      scope: input.scope,
      occurredAt,
      thresholds
    });
  } catch (monitoringError) {
    console.error("monitoring_api_error_capture_failed", monitoringError);
  }
}

export async function reportNotificationFailure(input: NotificationFailureInput) {
  const client = input.client ?? db;
  const occurredAt = new Date();

  try {
    const payload = {
      channel: input.channel,
      provider: input.provider ?? null,
      reason: input.reason,
      statusCode:
        typeof input.statusCode === "number" ? Math.trunc(input.statusCode) : null,
      recipientUserId: input.recipientUserId ?? null,
      sourceEntityType: input.sourceEntityType ?? null,
      sourceEntityId: input.sourceEntityId ?? null,
      eventType: input.eventType ?? null,
      message: extractErrorMessage(input.error),
      code: extractErrorCode(input.error),
      stack: extractErrorStack(input.error),
      occurredAt: toIsoTimestamp(occurredAt)
    };

    console.error("monitoring_notification_failure", payload);

    await logActivity({
      client,
      userId: input.actorAppUserId ?? null,
      action: "notification_delivery_failed",
      entityType: "notification_delivery",
      entityId: randomUUID(),
      description: `Notification delivery failure on ${input.channel}.`,
      metadata: payload
    });

    const thresholds = await getMonitoringThresholds(client);
    await evaluateNotificationFailureThreshold(client, {
      channel: input.channel,
      occurredAt,
      thresholds
    });
  } catch (monitoringError) {
    console.error(
      "monitoring_notification_failure_capture_failed",
      monitoringError
    );
  }
}
