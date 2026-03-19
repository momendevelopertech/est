import { z } from "zod";

export const trimmedOptionalString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional();

export const nonEmptyString = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);

export const uuidSchema = z.string().uuid();
export const localeQuerySchema = z.enum(["en", "ar"]);

export const booleanQueryParamSchema = z.preprocess((value) => {
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

export const integerQueryParamSchema = (options: { min: number; max?: number }) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }

    return value;
  }, z.number().int().min(options.min).max(options.max ?? Number.MAX_SAFE_INTEGER).optional());

export const paginationQueryFields = {
  page: integerQueryParamSchema({
    min: 1
  }),
  pageSize: integerQueryParamSchema({
    min: 1,
    max: 100
  })
};

export function createUpdateSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field must be provided."
    });
}
