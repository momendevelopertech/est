import { BlockStatus, LocaleCode, UserSource } from "@prisma/client";
import { z } from "zod";

import { ERROR_CODES } from "@/lib/errors/codes";
import { normalizePhone, validatePhone } from "@/lib/utils/phone";
import {
  booleanQueryParamSchema,
  createUpdateSchema,
  localeQuerySchema,
  nonEmptyString,
  paginationQueryFields,
  trimmedOptionalString,
  uuidSchema
} from "@/lib/validation/common";

const phoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .transform((value) => normalizePhone(value))
  .refine((value) => validatePhone(value), {
    message: ERROR_CODES.invalidPhone
  });

const preferredLanguageSchema = z.nativeEnum(LocaleCode).optional();
const nullableUuidSchema = z.union([uuidSchema, z.null()]);

const proctorMutationFields = {
  name: nonEmptyString(255),
  nameEn: trimmedOptionalString(255),
  phone: phoneSchema,
  nationalId: trimmedOptionalString(50),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase())
    .optional(),
  source: z.nativeEnum(UserSource),
  organization: trimmedOptionalString(255),
  branch: trimmedOptionalString(255),
  governorateId: nullableUuidSchema.optional(),
  preferredLanguage: z.union([preferredLanguageSchema, z.null()]).optional(),
  isActive: z.boolean().optional().default(true),
  notes: trimmedOptionalString(4000)
};

export const proctorListQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false),
  search: trimmedOptionalString(255),
  source: z.nativeEnum(UserSource).optional(),
  governorateId: uuidSchema.optional(),
  blockStatus: z.nativeEnum(BlockStatus).optional(),
  ...paginationQueryFields
});

export const proctorDetailQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false)
});

export const proctorExportQuerySchema = z.object({
  format: z.enum(["csv", "excel"]).default("csv"),
  status: z.enum(["active", "inactive", "all"]).default("active"),
  governorateId: uuidSchema.optional(),
  locale: localeQuerySchema.optional()
});

export const proctorRouteParamsSchema = z.object({
  proctorId: uuidSchema
});

export const createProctorSchema = z.object(proctorMutationFields);

export const updateProctorSchema = createUpdateSchema(proctorMutationFields);

export type ProctorListQuery = z.infer<typeof proctorListQuerySchema>;
export type CreateProctorInput = z.infer<typeof createProctorSchema>;
export type UpdateProctorInput = z.infer<typeof updateProctorSchema>;
export type ProctorExportQuery = z.infer<typeof proctorExportQuerySchema>;
