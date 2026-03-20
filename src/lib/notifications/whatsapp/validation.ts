import { z } from "zod";

import { ERROR_CODES } from "@/lib/errors/codes";
import { localeQuerySchema, uuidSchema } from "@/lib/validation/common";

import { whatsappProviderKeys } from "./contracts";

const notificationTypePattern = /^[a-z][a-z0-9_.-]{1,99}$/;

const localizedTextSchema = z.object({
  ar: z.string().trim().min(1).max(12000),
  en: z.string().trim().min(1).max(12000)
});

const whatsappVariablesSchema = z.record(
  z.string().trim().min(1).max(64),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

export const whatsappProviderSchema = z.enum(whatsappProviderKeys);

export const whatsappMessageTypeSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(notificationTypePattern, ERROR_CODES.validationError);

export const whatsappPhoneNumberSchema = z
  .string()
  .trim()
  .min(5)
  .max(64);

export const sendWhatsAppMessagePayloadSchema = z.object({
  type: whatsappMessageTypeSchema,
  recipientUserId: uuidSchema.nullish(),
  phoneNumber: whatsappPhoneNumberSchema.nullable(),
  locale: localeQuerySchema.default("en"),
  title: localizedTextSchema,
  body: localizedTextSchema,
  variables: whatsappVariablesSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
});

export const whatsappTestMessageSchema = z.object({
  phoneNumber: whatsappPhoneNumberSchema,
  locale: localeQuerySchema.default("en"),
  type: whatsappMessageTypeSchema.default("test_message"),
  title: localizedTextSchema.optional(),
  body: localizedTextSchema.optional(),
  variables: whatsappVariablesSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
});

export type SendWhatsAppMessagePayloadInput = z.infer<
  typeof sendWhatsAppMessagePayloadSchema
>;
export type WhatsAppTestMessageInput = z.infer<typeof whatsappTestMessageSchema>;
