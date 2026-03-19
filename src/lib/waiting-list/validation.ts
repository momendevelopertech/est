import { WaitingListStatus } from "@prisma/client";
import { z } from "zod";

import {
  paginationQueryFields,
  trimmedOptionalString,
  uuidSchema
} from "@/lib/validation/common";

export const waitingListRouteParamsSchema = z.object({
  waitingListId: uuidSchema
});

export const waitingListListQuerySchema = z.object({
  search: trimmedOptionalString(255),
  sessionId: uuidSchema.optional(),
  cycleId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  buildingId: uuidSchema.optional(),
  status: z.nativeEnum(WaitingListStatus).optional(),
  ...paginationQueryFields
});

export const createWaitingListEntrySchema = z.object({
  sessionId: uuidSchema,
  userId: uuidSchema,
  buildingId: uuidSchema.optional(),
  roleDefinitionId: uuidSchema.optional(),
  entrySource: trimmedOptionalString(100),
  reason: trimmedOptionalString(4000),
  notes: trimmedOptionalString(4000)
});

export const promoteWaitingListEntrySchema = z.object({
  buildingId: uuidSchema.optional(),
  roleDefinitionId: uuidSchema.optional(),
  floorId: uuidSchema.optional(),
  roomId: uuidSchema.optional(),
  overrideNote: trimmedOptionalString(4000)
});

export const removeWaitingListEntrySchema = z.object({
  reason: trimmedOptionalString(4000),
  notes: trimmedOptionalString(4000)
});

export type WaitingListRouteParams = z.infer<typeof waitingListRouteParamsSchema>;
export type WaitingListListQuery = z.infer<typeof waitingListListQuerySchema>;
export type CreateWaitingListEntryInput = z.infer<typeof createWaitingListEntrySchema>;
export type PromoteWaitingListEntryInput = z.infer<typeof promoteWaitingListEntrySchema>;
export type RemoveWaitingListEntryInput = z.infer<typeof removeWaitingListEntrySchema>;

