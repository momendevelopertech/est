import { z } from "zod";

import {
  paginationQueryFields,
  trimmedOptionalString,
  uuidSchema
} from "@/lib/validation/common";

import { evaluationRatingRange } from "./contracts";

const ratingValueSchema = z
  .number()
  .finite()
  .min(evaluationRatingRange.min)
  .max(evaluationRatingRange.max)
  .refine((value) => Number.isInteger(value * 100), {
    message: "Rating can include up to 2 decimal places."
  });

const ratingInputSchema = z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (normalized.length === 0) {
      return value;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, ratingValueSchema);

export const evaluationListQuerySchema = z.object({
  search: trimmedOptionalString(255),
  sessionId: uuidSchema.optional(),
  assignmentId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  evaluatorAppUserId: uuidSchema.optional(),
  ...paginationQueryFields
});

export const createEvaluationSchema = z.object({
  sessionId: uuidSchema,
  assignmentId: uuidSchema,
  userId: uuidSchema,
  rating: ratingInputSchema,
  notes: trimmedOptionalString(4000),
  allowUpdate: z.boolean().optional().default(false)
});

export type EvaluationListQuery = z.infer<typeof evaluationListQuerySchema>;
export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
