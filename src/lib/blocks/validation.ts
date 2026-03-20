import { BlockSource, BlockType } from "@prisma/client";
import { z } from "zod";

import { trimmedOptionalString, uuidSchema } from "@/lib/validation/common";

const dateInputSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (normalized.length === 0) {
      return value;
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }

  return value;
}, z.date());

const optionalDateInputSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return value;
}, dateInputSchema.optional());

export const createBlockSchema = z
  .object({
    userId: uuidSchema,
    type: z.nativeEnum(BlockType),
    startsAt: optionalDateInputSchema,
    endsAt: optionalDateInputSchema,
    source: z.nativeEnum(BlockSource).optional().default(BlockSource.MANUAL),
    reason: trimmedOptionalString(4000),
    notes: trimmedOptionalString(4000)
  })
  .superRefine((value, ctx) => {
    const startsAt = value.startsAt ?? new Date();

    if (value.type === BlockType.TEMPORARY && !value.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Temporary blocks require an end date."
      });
      return;
    }

    if (value.type === BlockType.PERMANENT && value.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Permanent blocks cannot define an end date."
      });
      return;
    }

    if (value.endsAt && value.endsAt.getTime() <= startsAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Block end date must be after the start date."
      });
    }
  });

export const unblockUserSchema = z.object({
  userId: uuidSchema,
  liftReason: trimmedOptionalString(4000),
  notes: trimmedOptionalString(4000)
});

export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type UnblockUserInput = z.infer<typeof unblockUserSchema>;
