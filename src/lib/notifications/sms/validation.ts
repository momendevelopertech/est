import { z } from "zod";

import { ERROR_CODES } from "@/lib/errors/codes";
import { localeQuerySchema, uuidSchema } from "@/lib/validation/common";

import { smsProviderKeys } from "./contracts";

const notificationTypePattern = /^[a-z][a-z0-9_.-]{1,99}$/;

const localizedTextSchema = z.object({
  ar: z.string().trim().min(1).max(12000),
  en: z.string().trim().min(1).max(12000)
});

const smsVariablesSchema = z.record(
  z.string().trim().min(1).max(64),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

export const smsProviderSchema = z.enum(smsProviderKeys);

export const smsMessageTypeSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(notificationTypePattern, ERROR_CODES.validationError);

export const smsPhoneNumberSchema = z
  .string()
  .trim()
  .min(5)
  .max(64);

export const sendSmsPayloadSchema = z.object({
  type: smsMessageTypeSchema,
  recipientUserId: uuidSchema.nullish(),
  phoneNumber: smsPhoneNumberSchema.nullable(),
  locale: localeQuerySchema.default("en"),
  title: localizedTextSchema,
  body: localizedTextSchema,
  variables: smsVariablesSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
});

export const smsTestMessageSchema = z.object({
  phoneNumber: smsPhoneNumberSchema,
  locale: localeQuerySchema.default("en"),
  type: smsMessageTypeSchema.default("test_message"),
  title: localizedTextSchema.optional(),
  body: localizedTextSchema.optional(),
  variables: smsVariablesSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
});

export type SendSmsPayloadInput = z.infer<typeof sendSmsPayloadSchema>;
export type SmsTestMessageInput = z.infer<typeof smsTestMessageSchema>;
