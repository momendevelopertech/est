import { ExamType } from "@prisma/client";
import { z } from "zod";

import {
  booleanQueryParamSchema,
  createUpdateSchema,
  nonEmptyString,
  paginationQueryFields,
  trimmedOptionalString,
  uuidSchema
} from "@/lib/validation/common";

const querySearchSchema = trimmedOptionalString(255);
const notesSchema = trimmedOptionalString(4000);
const sortOrderSchema = z.coerce.number().int().min(0).default(0);
const isActiveSchema = z.boolean().optional().default(true);

const bilingualLocationFields = {
  code: trimmedOptionalString(50),
  name: nonEmptyString(255),
  nameEn: trimmedOptionalString(255),
  sortOrder: sortOrderSchema,
  isActive: isActiveSchema,
  notes: notesSchema
};

export const governorateListQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false),
  search: querySearchSchema,
  ...paginationQueryFields
});

export const locationDetailQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false)
});

export const universityListQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false),
  search: querySearchSchema,
  governorateId: uuidSchema.optional(),
  ...paginationQueryFields
});

export const buildingListQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false),
  search: querySearchSchema,
  universityId: uuidSchema.optional(),
  ...paginationQueryFields
});

export const floorListQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false),
  search: querySearchSchema,
  buildingId: uuidSchema.optional(),
  ...paginationQueryFields
});

export const roomListQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false),
  search: querySearchSchema,
  floorId: uuidSchema.optional(),
  ...paginationQueryFields
});

export const locationsTreeQuerySchema = z.object({
  includeInactive: booleanQueryParamSchema.default(false)
});

export const createGovernorateSchema = z.object(bilingualLocationFields);
export const updateGovernorateSchema = createUpdateSchema(bilingualLocationFields);

export const createUniversitySchema = z.object({
  governorateId: uuidSchema,
  ...bilingualLocationFields
});
export const updateUniversitySchema = createUpdateSchema({
  governorateId: uuidSchema,
  ...bilingualLocationFields
});

export const createBuildingSchema = z.object({
  universityId: uuidSchema,
  address: trimmedOptionalString(4000),
  ...bilingualLocationFields
});
export const updateBuildingSchema = createUpdateSchema({
  universityId: uuidSchema,
  address: trimmedOptionalString(4000),
  ...bilingualLocationFields
});

export const createFloorSchema = z.object({
  buildingId: uuidSchema,
  levelNumber: z.coerce.number().int().optional(),
  ...bilingualLocationFields
});
export const updateFloorSchema = createUpdateSchema({
  buildingId: uuidSchema,
  levelNumber: z.coerce.number().int().optional(),
  ...bilingualLocationFields
});

export const createRoomSchema = z
  .object({
    floorId: uuidSchema,
    code: trimmedOptionalString(50),
    name: nonEmptyString(255),
    nameEn: trimmedOptionalString(255),
    roomType: nonEmptyString(100),
    supportedExamTypes: z.array(z.nativeEnum(ExamType)).min(1),
    capacityMin: z.coerce.number().int().min(0).default(0),
    capacityMax: z.coerce.number().int().min(1),
    isActive: isActiveSchema,
    notes: notesSchema
  })
  .refine((value) => value.capacityMax >= value.capacityMin, {
    message: "capacityMax must be greater than or equal to capacityMin",
    path: ["capacityMax"]
  });

export const updateRoomSchema = createUpdateSchema({
  floorId: uuidSchema,
  code: trimmedOptionalString(50),
  name: nonEmptyString(255),
  nameEn: trimmedOptionalString(255),
  roomType: nonEmptyString(100),
  supportedExamTypes: z.array(z.nativeEnum(ExamType)).min(1),
  capacityMin: z.coerce.number().int().min(0),
  capacityMax: z.coerce.number().int().min(1),
  isActive: z.boolean(),
  notes: notesSchema
}).refine(
  (value) =>
    value.capacityMin === undefined ||
    value.capacityMax === undefined ||
    value.capacityMax >= value.capacityMin,
  {
    message: "capacityMax must be greater than or equal to capacityMin",
    path: ["capacityMax"]
  }
);

export type GovernorateListQuery = z.infer<typeof governorateListQuerySchema>;
export type UniversityListQuery = z.infer<typeof universityListQuerySchema>;
export type BuildingListQuery = z.infer<typeof buildingListQuerySchema>;
export type FloorListQuery = z.infer<typeof floorListQuerySchema>;
export type RoomListQuery = z.infer<typeof roomListQuerySchema>;

export type CreateGovernorateInput = z.infer<typeof createGovernorateSchema>;
export type UpdateGovernorateInput = z.infer<typeof updateGovernorateSchema>;
export type CreateUniversityInput = z.infer<typeof createUniversitySchema>;
export type UpdateUniversityInput = z.infer<typeof updateUniversitySchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
