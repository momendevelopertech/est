import type { PaginationMeta } from "@/lib/pagination";

export type InAppNotificationLocalizedTextContract = {
  en: string;
  ar: string;
};

export type InAppNotificationMetadataContract = Record<string, unknown> | null;

export type InAppNotificationContract = {
  id: string;
  userId: string;
  type: string;
  title: InAppNotificationLocalizedTextContract;
  body: InAppNotificationLocalizedTextContract;
  readAt: Date | null;
  metadata: InAppNotificationMetadataContract;
  createdAt: Date;
};

export type InAppNotificationListResultContract = {
  data: InAppNotificationContract[];
  total: number;
  unreadCount: number;
  pagination: PaginationMeta;
};

export type CreateInAppNotificationPayloadContract = {
  type: string;
  title: InAppNotificationLocalizedTextContract;
  body: InAppNotificationLocalizedTextContract;
  metadata?: InAppNotificationMetadataContract;
};

export type MarkAllAsReadResultContract = {
  updatedCount: number;
  readAt: Date;
};
