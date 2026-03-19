import { CloneMode, CycleStatus } from "@prisma/client";
import { z } from "zod";

import {
  booleanQueryParamSchema,
  createUpdateSchema,
  paginationQueryFields,
  trimmedOptionalString,
  uuidSchema
} from "@/lib/validation/common";

const dateInputSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }

  return value;
}, z.date());

const cycleMutationFields = {
  code: trimmedOptionalString(100),
  name: trimmedOptionalString(255),
  nameEn: trimmedOptionalString(255),
  status: z.nativeEnum(CycleStatus).optional().default(CycleStatus.DRAFT),
  startDate: dateInputSchema,
  endDate: dateInputSchema,
  sourceCycleId: uuidSchema.optional(),
  cloneMode: z.nativeEnum(CloneMode).optional(),
  notes: trimmedOptionalString(4000),
  isActive: z.boolean().optional().default(true)
};

function hasLocalizedName(value: { name?: string; nameEn?: string }) {
  return Boolean(value.name?.trim() || value.nameEn?.trim());
}

function hasValidDateRange(value: { startDate?: Date; endDate?: Date }) {
  if (!value.startDate || !value.endDate) {
    return false;
  }

  return value.startDate.getTime() < value.endDate.getTime();
}

export const cycleListQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false),
  search: trimmedOptionalString(255),
  ...paginationQueryFields
});

export const cycleDetailQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false)
});

export const cycleRouteParamsSchema = z.object({
  cycleId: uuidSchema
});

export const createCycleSchema = z
  .object(cycleMutationFields)
  .refine((value) => hasLocalizedName(value), {
    message: "Either name or nameEn is required.",
    path: ["name"]
  })
  .refine((value) => hasValidDateRange(value), {
    message: "startDate must be earlier than endDate.",
    path: ["endDate"]
  });

export const updateCycleSchema = createUpdateSchema({
  code: trimmedOptionalString(100),
  name: trimmedOptionalString(255),
  nameEn: trimmedOptionalString(255),
  status: z.nativeEnum(CycleStatus),
  startDate: dateInputSchema.optional(),
  endDate: dateInputSchema.optional(),
  sourceCycleId: uuidSchema.optional(),
  cloneMode: z.nativeEnum(CloneMode).optional(),
  notes: trimmedOptionalString(4000),
  isActive: z.boolean()
});

export const cloneCycleSchema = z
  .object({
    newStartDate: dateInputSchema,
    newEndDate: dateInputSchema,
    allowInactiveSource: z.boolean().optional().default(false)
  })
  .refine((value) => value.newStartDate.getTime() < value.newEndDate.getTime(), {
    message: "newStartDate must be earlier than newEndDate.",
    path: ["newEndDate"]
  });

export type CycleListQuery = z.infer<typeof cycleListQuerySchema>;
export type CreateCycleInput = z.infer<typeof createCycleSchema>;
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;
export type CloneCycleInput = z.infer<typeof cloneCycleSchema>;
