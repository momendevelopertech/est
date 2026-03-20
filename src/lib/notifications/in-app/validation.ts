import { z } from "zod";

import { ERROR_CODES } from "@/lib/errors/codes";
import {
  booleanQueryParamSchema,
  paginationQueryFields,
  uuidSchema
} from "@/lib/validation/common";

const notificationTypePattern = /^[a-z][a-z0-9_.-]{1,99}$/;

const localizedNotificationTitleSchema = z.object({
  ar: z.string().trim().max(500),
  en: z.string().trim().max(500)
});

const localizedNotificationBodySchema = z.object({
  ar: z.string().trim().max(12000),
  en: z.string().trim().max(12000)
});

export const inAppNotificationTypeSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(notificationTypePattern, ERROR_CODES.validationError);

export const createInAppNotificationPayloadSchema = z.object({
  type: inAppNotificationTypeSchema,
  title: localizedNotificationTitleSchema,
  body: localizedNotificationBodySchema,
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
});

export const inAppNotificationsQuerySchema = z.object({
  type: inAppNotificationTypeSchema.optional(),
  unreadOnly: booleanQueryParamSchema.default(false),
  ...paginationQueryFields
});

export const markInAppNotificationReadSchema = z.object({
  notificationId: uuidSchema
});

export const markAllInAppNotificationsReadSchema = z.object({});

export type CreateInAppNotificationPayloadInput = z.infer<
  typeof createInAppNotificationPayloadSchema
>;
export type InAppNotificationsQuery = z.infer<
  typeof inAppNotificationsQuerySchema
>;
export type MarkInAppNotificationReadInput = z.infer<
  typeof markInAppNotificationReadSchema
>;
