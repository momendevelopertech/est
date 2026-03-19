import { z } from "zod";

import { trimmedOptionalString, uuidSchema } from "@/lib/validation/common";

const swapBaseFields = {
  sessionId: uuidSchema,
  manualOverride: z.boolean().optional().default(false),
  overrideNote: trimmedOptionalString(4000)
};

const directAssignmentSwapSchema = z
  .object({
    kind: z.literal("DIRECT_ASSIGNMENT_SWAP"),
    ...swapBaseFields,
    primaryAssignmentId: uuidSchema,
    secondaryAssignmentId: uuidSchema
  })
  .superRefine((value, ctx) => {
    if (value.primaryAssignmentId === value.secondaryAssignmentId) {
      ctx.addIssue({
        code: "custom",
        message: "Direct swap requires two different assignment IDs.",
        path: ["secondaryAssignmentId"]
      });
    }
  });

const waitingListReplacementSwapSchema = z.object({
  kind: z.literal("WAITING_LIST_REPLACEMENT"),
  ...swapBaseFields,
  assignmentId: uuidSchema,
  waitingListId: uuidSchema,
  demoteCurrentAssignee: z.boolean().optional().default(true),
  demotionReason: trimmedOptionalString(4000),
  demotionNotes: trimmedOptionalString(4000)
});

const manualReplacementSwapSchema = z.object({
  kind: z.literal("MANUAL_REPLACEMENT"),
  ...swapBaseFields,
  assignmentId: uuidSchema,
  replacementUserId: uuidSchema,
  demoteCurrentAssignee: z.boolean().optional().default(true),
  demotionReason: trimmedOptionalString(4000),
  demotionNotes: trimmedOptionalString(4000)
});

export const executeSwapSchema = z.discriminatedUnion("kind", [
  directAssignmentSwapSchema,
  waitingListReplacementSwapSchema,
  manualReplacementSwapSchema
]);

export type ExecuteSwapInput = z.infer<typeof executeSwapSchema>;
