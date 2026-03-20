import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";

import { uuidSchema } from "@/lib/validation/common";

import { notificationTriggerEventTypes } from "./contracts";

const swapKindSchema = z.enum([
  "DIRECT_ASSIGNMENT_SWAP",
  "WAITING_LIST_REPLACEMENT",
  "MANUAL_REPLACEMENT"
]);

const uniqueUuidArraySchema = z
  .array(uuidSchema)
  .min(1)
  .max(250)
  .superRefine((value, ctx) => {
    if (new Set(value).size !== value.length) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate values are not allowed."
      });
    }
  });

export const assignmentCreatedTriggerSchema = z.object({
  eventType: z.literal("assignment_created"),
  payload: z.object({
    assignmentId: uuidSchema
  })
});

export const assignmentSwappedTriggerSchema = z.object({
  eventType: z.literal("assignment_swapped"),
  payload: z.object({
    sessionId: uuidSchema,
    changedAssignmentIds: uniqueUuidArraySchema,
    swapKind: swapKindSchema
  })
});

export const attendanceMarkedTriggerSchema = z.object({
  eventType: z.literal("attendance_marked"),
  payload: z.object({
    assignmentId: uuidSchema,
    attendanceStatus: z.enum([
      AttendanceStatus.CONFIRMED,
      AttendanceStatus.ABSENT,
      AttendanceStatus.DECLINED
    ])
  })
});

export const waitingListPromotedTriggerSchema = z.object({
  eventType: z.literal("waiting_list_promoted"),
  payload: z.object({
    waitingListId: uuidSchema,
    assignmentId: uuidSchema
  })
});

export const userBlockStatusChangedTriggerSchema = z.object({
  eventType: z.literal("user_block_status_changed"),
  payload: z.object({
    userId: uuidSchema,
    mode: z.enum(["blocked", "unblocked"]),
    blockId: uuidSchema.nullish()
  })
});

export const executeNotificationTriggerSchema = z.discriminatedUnion("eventType", [
  assignmentCreatedTriggerSchema,
  assignmentSwappedTriggerSchema,
  attendanceMarkedTriggerSchema,
  waitingListPromotedTriggerSchema,
  userBlockStatusChangedTriggerSchema
]);

export const notificationTriggerEventTypeSchema = z.enum(
  notificationTriggerEventTypes
);

export type ExecuteNotificationTriggerInput = z.infer<
  typeof executeNotificationTriggerSchema
>;
