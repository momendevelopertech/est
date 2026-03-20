import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";

import {
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

  if (typeof value === "string") {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return value;
}, z.date().optional());

export const attendanceListQuerySchema = z.object({
  search: trimmedOptionalString(255),
  sessionId: uuidSchema.optional(),
  assignmentId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  ...paginationQueryFields
});

export const updateAttendanceSchema = z
  .object({
    assignmentId: uuidSchema,
    status: z.nativeEnum(AttendanceStatus),
    notes: trimmedOptionalString(4000),
    checkedInAt: dateInputSchema,
    replacementWaitingListId: uuidSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (
      value.replacementWaitingListId &&
      value.status !== AttendanceStatus.ABSENT &&
      value.status !== AttendanceStatus.DECLINED
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Replacement promotion is allowed only when attendance is ABSENT or DECLINED.",
        path: ["replacementWaitingListId"]
      });
    }
  });

export const attendanceReplacementQuerySchema = z.object({
  assignmentId: uuidSchema
});

export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type AttendanceReplacementQuery = z.infer<
  typeof attendanceReplacementQuerySchema
>;
