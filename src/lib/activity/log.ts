import { Prisma, type PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";

type ActivityClient = Prisma.TransactionClient | PrismaClient;

type LogActivityParams = {
  action: string;
  afterPayload?: unknown;
  beforePayload?: unknown;
  client?: ActivityClient;
  description?: string;
  entityId: string;
  entityType: string;
  metadata?: Record<string, unknown>;
  userId?: string | null;
};

function toJsonValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function logActivity(params: LogActivityParams) {
  const client = params.client ?? db;

  return client.activityLog.create({
    data: {
      actorAppUserId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      metadata: toJsonValue({
        userId: params.userId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        ...(params.metadata ?? {})
      }),
      beforePayload: toJsonValue(params.beforePayload),
      afterPayload: toJsonValue(params.afterPayload)
    } satisfies Prisma.ActivityLogUncheckedCreateInput
  });
}
