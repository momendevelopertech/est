import { AssignmentMethod, AssignmentStatus } from "@prisma/client";
import { z } from "zod";

import {
  paginationQueryFields,
  trimmedOptionalString,
  uuidSchema
} from "@/lib/validation/common";

export const assignmentRouteParamsSchema = z.object({
  assignmentId: uuidSchema
});

export const assignmentListQuerySchema = z.object({
  search: trimmedOptionalString(255),
  sessionId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  buildingId: uuidSchema.optional(),
  roleDefinitionId: uuidSchema.optional(),
  status: z.nativeEnum(AssignmentStatus).optional(),
  assignedMethod: z.nativeEnum(AssignmentMethod).optional(),
  ...paginationQueryFields
});

export const createAssignmentSchema = z.object({
  sessionId: uuidSchema,
  userId: uuidSchema,
  buildingId: uuidSchema,
  floorId: uuidSchema.optional(),
  roomId: uuidSchema.optional(),
  roleDefinitionId: uuidSchema,
  assignedMethod: z.literal(AssignmentMethod.MANUAL).optional().default(AssignmentMethod.MANUAL),
  overrideNote: trimmedOptionalString(4000)
});

export type AssignmentRouteParams = z.infer<typeof assignmentRouteParamsSchema>;
export type AssignmentListQuery = z.infer<typeof assignmentListQuerySchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
