import { ExamType, SessionStatus } from "@prisma/client";
import { z } from "zod";

import {
  booleanQueryParamSchema,
  createUpdateSchema,
  paginationQueryFields,
  trimmedOptionalString,
  uuidSchema
} from "@/lib/validation/common";

function hasExplicitTimeZone(value: string) {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
}

const zonedDateTimeStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => hasExplicitTimeZone(value), {
    message: "DateTime values must include a timezone offset or Z."
  })
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid datetime."
  })
  .transform((value) => new Date(value));

const dateTimeInputSchema = z
  .union([z.date(), zonedDateTimeStringSchema])
  .transform((value) => new Date(value));

const nullableDateTimeInputSchema = z.union([dateTimeInputSchema, z.null()]);

const buildingIdsSchema = z
  .array(uuidSchema)
  .min(1, "At least one building is required.")
  .max(100, "A session cannot include more than 100 buildings.")
  .superRefine((value, ctx) => {
    if (new Set(value).size !== value.length) {
      ctx.addIssue({
        code: "custom",
        message: "buildingIds must not contain duplicates."
      });
    }
  });

const sessionMutationFields = {
  cycleId: uuidSchema,
  name: trimmedOptionalString(255),
  nameEn: trimmedOptionalString(255),
  examType: z.nativeEnum(ExamType),
  startDateTime: dateTimeInputSchema,
  endDateTime: dateTimeInputSchema,
  buildingIds: buildingIdsSchema,
  status: z.nativeEnum(SessionStatus).optional().default(SessionStatus.DRAFT),
  lockedAt: nullableDateTimeInputSchema.optional(),
  notes: trimmedOptionalString(4000),
  isActive: z.boolean().optional().default(true)
};

function hasLocalizedName(value: { name?: string; nameEn?: string }) {
  return Boolean(value.name?.trim() || value.nameEn?.trim());
}

function hasValidDateRange(value: {
  startDateTime?: Date;
  endDateTime?: Date;
}) {
  if (!value.startDateTime || !value.endDateTime) {
    return false;
  }

  return value.startDateTime.getTime() < value.endDateTime.getTime();
}

export const sessionListQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false),
  search: trimmedOptionalString(255),
  cycleId: uuidSchema.optional(),
  buildingId: uuidSchema.optional(),
  examType: z.nativeEnum(ExamType).optional(),
  status: z.nativeEnum(SessionStatus).optional(),
  startFrom: dateTimeInputSchema.optional(),
  endTo: dateTimeInputSchema.optional(),
  ...paginationQueryFields
}).refine(
  (value) =>
    value.startFrom === undefined ||
    value.endTo === undefined ||
    value.startFrom.getTime() < value.endTo.getTime(),
  {
    message: "startFrom must be earlier than endTo.",
    path: ["endTo"]
  }
);

export const sessionDetailQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false)
});

export const sessionRouteParamsSchema = z.object({
  sessionId: uuidSchema
});

export const createSessionSchema = z
  .object(sessionMutationFields)
  .refine((value) => hasLocalizedName(value), {
    message: "Either name or nameEn is required.",
    path: ["name"]
  })
  .refine((value) => hasValidDateRange(value), {
    message: "startDateTime must be earlier than endDateTime.",
    path: ["endDateTime"]
  });

export const updateSessionSchema = createUpdateSchema({
  cycleId: uuidSchema,
  name: trimmedOptionalString(255),
  nameEn: trimmedOptionalString(255),
  examType: z.nativeEnum(ExamType),
  startDateTime: dateTimeInputSchema.optional(),
  endDateTime: dateTimeInputSchema.optional(),
  buildingIds: buildingIdsSchema.optional(),
  status: z.nativeEnum(SessionStatus),
  lockedAt: nullableDateTimeInputSchema,
  notes: trimmedOptionalString(4000),
  isActive: z.boolean()
}).refine(
  (value) =>
    value.startDateTime === undefined ||
    value.endDateTime === undefined ||
    value.startDateTime.getTime() < value.endDateTime.getTime(),
  {
    message: "startDateTime must be earlier than endDateTime.",
    path: ["endDateTime"]
  }
);

export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
