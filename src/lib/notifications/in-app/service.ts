import { Prisma, type PrismaClient } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";

import type {
  CreateInAppNotificationPayloadContract,
  InAppNotificationContract,
  InAppNotificationListResultContract,
  MarkAllAsReadResultContract
} from "./contracts";
import {
  createInAppNotificationPayloadSchema,
  type InAppNotificationsQuery
} from "./validation";

type QueryClient = Prisma.TransactionClient | PrismaClient;

const inAppNotificationSelect = {
  id: true,
  userId: true,
  type: true,
  titleAr: true,
  titleEn: true,
  bodyAr: true,
  bodyEn: true,
  readAt: true,
  metadata: true,
  createdAt: true
} satisfies Prisma.InAppNotificationSelect;

type InAppNotificationRecord = Prisma.InAppNotificationGetPayload<{
  select: typeof inAppNotificationSelect;
}>;

type NotificationReadMutationResult = {
  mode: "single";
  data: InAppNotificationContract;
};

export class InAppNotificationsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "InAppNotificationsServiceError";
  }
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeType(value: string) {
  return value.trim().toLowerCase();
}

function toMetadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toNotificationContract(record: InAppNotificationRecord): InAppNotificationContract {
  return {
    id: record.id,
    userId: record.userId,
    type: record.type,
    title: {
      ar: record.titleAr,
      en: record.titleEn
    },
    body: {
      ar: record.bodyAr,
      en: record.bodyEn
    },
    readAt: record.readAt,
    metadata: toMetadataRecord(record.metadata),
    createdAt: record.createdAt
  };
}

function toJsonValue(value: Record<string, unknown> | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
    throw new InAppNotificationsServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found for in-app notification operation.",
      {
        userId
      }
    );
  }
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2003") {
    throw new InAppNotificationsServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found for in-app notification operation.",
      error.meta ?? null
    );
  }

  if (isKnownPrismaError(error) && error.code === "P2025") {
    throw new InAppNotificationsServiceError(
      ERROR_CODES.notificationNotFound,
      404,
      "In-app notification not found."
    );
  }

  throw error;
}

export async function resolveNotificationUserIdForAppUser(
  appUserId: string,
  options: {
    client?: QueryClient;
  } = {}
): Promise<string | null> {
  const client = options.client ?? db;
  const appUser = await client.appUser.findUnique({
    where: {
      id: appUserId
    },
    select: {
      linkedUserId: true
    }
  });

  return appUser?.linkedUserId ?? null;
}

export async function createNotification(
  userId: string,
  payload: CreateInAppNotificationPayloadContract,
  options: {
    actorAppUserId?: string;
    client?: QueryClient;
  } = {}
): Promise<InAppNotificationContract> {
  const client = options.client ?? db;
  const contractPayload = createInAppNotificationPayloadSchema.parse(payload);

  try {
    await assertUserExists(client, userId);

    const created = await client.inAppNotification.create({
      data: {
        userId,
        type: normalizeType(contractPayload.type),
        titleAr: contractPayload.title.ar,
        titleEn: contractPayload.title.en,
        bodyAr: contractPayload.body.ar,
        bodyEn: contractPayload.body.en,
        metadata: toJsonValue(contractPayload.metadata)
      },
      select: inAppNotificationSelect
    });

    await logActivity({
      client,
      userId: options.actorAppUserId ?? null,
      action: "notification_created",
      entityType: "notification",
      entityId: created.id,
      description: `Created in-app notification ${created.type} for user ${created.userId}.`,
      metadata: {
        notificationId: created.id,
        targetUserId: created.userId,
        notificationType: created.type
      },
      afterPayload: created
    });

    return toNotificationContract(created);
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function listUserNotifications(
  userId: string,
  query: InAppNotificationsQuery
): Promise<InAppNotificationListResultContract> {
  const pagination = resolvePagination(query);
  const normalizedType = query.type ? normalizeType(query.type) : null;
  const where: Prisma.InAppNotificationWhereInput = {
    userId,
    ...(normalizedType
      ? {
          type: {
            equals: normalizedType,
            mode: "insensitive"
          }
        }
      : {}),
    ...(query.unreadOnly
      ? {
          readAt: null
        }
      : {})
  };

  const [records, total, unreadCount] = await Promise.all([
    db.inAppNotification.findMany({
      where,
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "desc"
        }
      ],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: inAppNotificationSelect
    }),
    db.inAppNotification.count({
      where
    }),
    db.inAppNotification.count({
      where: {
        userId,
        readAt: null
      }
    })
  ]);

  return {
    data: records.map((record) => toNotificationContract(record)),
    total,
    unreadCount,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function markAsRead(
  notificationId: string,
  options: {
    userId?: string;
    actorAppUserId?: string;
    client?: QueryClient;
  } = {}
): Promise<NotificationReadMutationResult> {
  const client = options.client ?? db;
  const existing = await client.inAppNotification.findFirst({
    where: {
      id: notificationId,
      ...(options.userId
        ? {
            userId: options.userId
          }
        : {})
    },
    select: inAppNotificationSelect
  });

  if (!existing) {
    throw new InAppNotificationsServiceError(
      ERROR_CODES.notificationNotFound,
      404,
      "In-app notification not found.",
      {
        notificationId
      }
    );
  }

  const nextReadAt = existing.readAt ?? new Date();
  const updated =
    existing.readAt === null
      ? await client.inAppNotification.update({
          where: {
            id: existing.id
          },
          data: {
            readAt: nextReadAt
          },
          select: inAppNotificationSelect
        })
      : existing;

  await logActivity({
    client,
    userId: options.actorAppUserId ?? null,
    action: "notification_read",
    entityType: "notification",
    entityId: updated.id,
    description: `Marked notification ${updated.id} as read.`,
    metadata: {
      notificationId: updated.id,
      targetUserId: updated.userId,
      alreadyRead: existing.readAt !== null,
      mode: "single"
    },
    beforePayload: existing,
    afterPayload: updated
  });

  return {
    mode: "single",
    data: toNotificationContract(updated)
  };
}

export async function markAllAsRead(
  userId: string,
  options: {
    actorAppUserId?: string;
    client?: QueryClient;
  } = {}
): Promise<MarkAllAsReadResultContract> {
  const client = options.client ?? db;
  const readAt = new Date();
  const result = await client.inAppNotification.updateMany({
    where: {
      userId,
      readAt: null
    },
    data: {
      readAt
    }
  });

  if (result.count > 0) {
    await logActivity({
      client,
      userId: options.actorAppUserId ?? null,
      action: "notification_read",
      entityType: "notification",
      entityId: userId,
      description: `Marked ${result.count} notifications as read for user ${userId}.`,
      metadata: {
        targetUserId: userId,
        updatedCount: result.count,
        mode: "all"
      }
    });
  }

  return {
    updatedCount: result.count,
    readAt
  };
}
