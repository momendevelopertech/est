import { BlockStatus, LocaleCode, UserSource } from "@prisma/client";
import { z } from "zod";

const trimmedOptionalString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional();

const nonEmptyString = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);

const uuidSchema = z.string().uuid();
const localeQuerySchema = z.enum(["en", "ar"]);

const booleanQueryParamSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return undefined;
}, z.boolean().optional());

function createUpdateSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field must be provided."
    });
}

const preferredLanguageSchema = z.nativeEnum(LocaleCode).optional();
const nullableUuidSchema = z.union([uuidSchema, z.null()]);

const proctorMutationFields = {
  name: nonEmptyString(255),
  nameEn: trimmedOptionalString(255),
  phone: nonEmptyString(50),
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
  blockStatus: z.nativeEnum(BlockStatus).optional()
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
