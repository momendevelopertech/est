import { z } from "zod";

import { ERROR_CODES } from "@/lib/errors/codes";
import {
  booleanQueryParamSchema,
  localeQuerySchema,
  nonEmptyString,
  uuidSchema
} from "@/lib/validation/common";

const templateKeyPattern = /^[a-z][a-z0-9_.-]{2,149}$/;
const templateTypePattern = /^[a-z][a-z0-9_.-]{1,99}$/;
const templateVariablePattern = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;

export const notificationEmailTemplateKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(150)
  .regex(templateKeyPattern, ERROR_CODES.validationError);

export const notificationEmailTemplateTypeSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(templateTypePattern, ERROR_CODES.validationError);

export const notificationEmailTemplateVariableSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(templateVariablePattern, ERROR_CODES.validationError);

const localizedSubjectSchema = z.object({
  ar: nonEmptyString(500),
  en: nonEmptyString(500)
});

const localizedBodySchema = z.object({
  ar: nonEmptyString(12000),
  en: nonEmptyString(12000)
});

const templateVariablesSchema = z
  .array(notificationEmailTemplateVariableSchema)
  .max(100)
  .default([])
  .refine((variables) => new Set(variables).size === variables.length, {
    message: ERROR_CODES.validationError
  });

const previewVariableValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);

export const notificationEmailTemplatesQuerySchema = z.object({
  type: notificationEmailTemplateTypeSchema.optional(),
  includeInactive: booleanQueryParamSchema.default(false)
});

export const upsertNotificationEmailTemplateSchema = z.object({
  templateId: uuidSchema.optional(),
  key: notificationEmailTemplateKeySchema,
  type: notificationEmailTemplateTypeSchema,
  variables: templateVariablesSchema,
  subject: localizedSubjectSchema,
  body: localizedBodySchema,
  isActive: z.boolean().default(true)
});

export const notificationEmailPreviewSchema = z
  .object({
    templateId: uuidSchema.optional(),
    templateKey: notificationEmailTemplateKeySchema.optional(),
    locale: localeQuerySchema.default("en"),
    variables: z
      .record(z.string(), previewVariableValueSchema)
      .default({})
  })
  .refine((value) => Boolean(value.templateId || value.templateKey), {
    message: ERROR_CODES.validationError
  });

export type NotificationEmailTemplatesQuery = z.infer<
  typeof notificationEmailTemplatesQuerySchema
>;
export type UpsertNotificationEmailTemplateInput = z.infer<
  typeof upsertNotificationEmailTemplateSchema
>;
export type NotificationEmailPreviewInput = z.infer<
  typeof notificationEmailPreviewSchema
>;
