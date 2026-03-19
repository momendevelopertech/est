import { Prisma, ExamType, type ExamType as ExamTypeValue } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";
import { createBilingualSearchFilter } from "@/lib/search/bilingual";

import type {
  BuildingListQuery,
  CreateBuildingInput,
  CreateFloorInput,
  CreateGovernorateInput,
  CreateRoomInput,
  CreateUniversityInput,
  FloorListQuery,
  GovernorateListQuery,
  RoomListQuery,
  UniversityListQuery,
  UpdateBuildingInput,
  UpdateFloorInput,
  UpdateGovernorateInput,
  UpdateRoomInput,
  UpdateUniversityInput
} from "./validation";

type IncludeInactiveOptions = {
  includeInactive?: boolean;
  requireActiveParent?: boolean;
};

type ScopedLocationMatch = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

type DuplicateCheckInput = {
  entityType: "governorate" | "university" | "building" | "floor" | "room";
  name?: string | null;
  code?: string | null;
  excludeId?: string;
  scope?: Record<string, string>;
};

export class LocationsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "LocationsServiceError";
  }
}

const governorateSelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  sortOrder: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      universities: true
    }
  }
} satisfies Prisma.GovernorateSelect;

const universitySelect = {
  id: true,
  governorateId: true,
  code: true,
  name: true,
  nameEn: true,
  sortOrder: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  governorate: {
    select: {
      id: true,
      name: true,
      nameEn: true
    }
  },
  _count: {
    select: {
      buildings: true
    }
  }
} satisfies Prisma.UniversitySelect;

const buildingSelect = {
  id: true,
  universityId: true,
  code: true,
  name: true,
  nameEn: true,
  address: true,
  sortOrder: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  university: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      governorateId: true,
      governorate: {
        select: {
          id: true,
          name: true,
          nameEn: true
        }
      }
    }
  },
  _count: {
    select: {
      floors: true
    }
  }
} satisfies Prisma.BuildingSelect;

const floorSelect = {
  id: true,
  buildingId: true,
  code: true,
  name: true,
  nameEn: true,
  levelNumber: true,
  sortOrder: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  building: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      universityId: true,
      university: {
        select: {
          id: true,
          name: true,
          nameEn: true
        }
      }
    }
  },
  _count: {
    select: {
      rooms: true
    }
  }
} satisfies Prisma.FloorSelect;

const roomSelect = {
  id: true,
  floorId: true,
  code: true,
  name: true,
  nameEn: true,
  roomType: true,
  supportedExamTypes: true,
  capacityMin: true,
  capacityMax: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  floor: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      buildingId: true,
      building: {
        select: {
          id: true,
          name: true,
          nameEn: true
        }
      }
    }
  },
  _count: {
    select: {
      assignments: true
    }
  }
} satisfies Prisma.RoomSelect;

const locationTreeSelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  sortOrder: true,
  isActive: true,
  notes: true,
  universities: {
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      governorateId: true,
      code: true,
      name: true,
      nameEn: true,
      sortOrder: true,
      isActive: true,
      notes: true,
      buildings: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          universityId: true,
          code: true,
          name: true,
          nameEn: true,
          address: true,
          sortOrder: true,
          isActive: true,
          notes: true,
          floors: {
            orderBy: [{ sortOrder: "asc" }, { levelNumber: "asc" }, { name: "asc" }],
            select: {
              id: true,
              buildingId: true,
              code: true,
              name: true,
              nameEn: true,
              levelNumber: true,
              sortOrder: true,
              isActive: true,
              notes: true,
              rooms: {
                orderBy: [{ name: "asc" }],
                select: {
                  id: true,
                  floorId: true,
                  code: true,
                  name: true,
                  nameEn: true,
                  roomType: true,
                  supportedExamTypes: true,
                  capacityMin: true,
                  capacityMax: true,
                  isActive: true,
                  notes: true
                }
              }
            }
          }
        }
      }
    }
  }
} satisfies Prisma.GovernorateSelect;

function createSearchFilter(search?: string) {
  return createBilingualSearchFilter(search, ["code"]);
}

function createActiveFilter(includeInactive: boolean) {
  return includeInactive ? {} : { isActive: true };
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function isNotFoundError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return isKnownPrismaError(error) && error.code === "P2025";
}

function toConflictError(error: Prisma.PrismaClientKnownRequestError) {
  return new LocationsServiceError(
    ERROR_CODES.uniqueConstraintViolation,
    409,
    "The requested location change conflicts with an existing record.",
    error.meta ?? null
  );
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2002") {
    throw toConflictError(error);
  }

  if (isNotFoundError(error)) {
    throw new LocationsServiceError(
      ERROR_CODES.locationNotFound,
      404,
      "The requested location was not found."
    );
  }

  throw error;
}

function normalizeComparableText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function throwTypedValidationError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): never {
  throw new LocationsServiceError(code, 409, message, details ?? null);
}

function validateSupportedExamTypes(
  supportedExamTypes?: readonly string[] | null
): ExamTypeValue[] | undefined {
  if (!supportedExamTypes) {
    return undefined;
  }

  const invalidValues = supportedExamTypes.filter(
    (examType) => !Object.values(ExamType).includes(examType as ExamType)
  );

  if (invalidValues.length > 0) {
    throw new LocationsServiceError(
      ERROR_CODES.invalidExamType,
      400,
      "supportedExamTypes contains invalid exam types.",
      {
        invalidValues
      }
    );
  }

  return [...supportedExamTypes] as ExamTypeValue[];
}

export function validateRoomIntegrity(
  input: {
    supportedExamTypes?: readonly string[] | null;
    capacityMin?: number;
    capacityMax?: number;
  },
  current?: { capacityMin: number; capacityMax: number }
) {
  validateSupportedExamTypes(input.supportedExamTypes);

  const capacityMin = input.capacityMin ?? current?.capacityMin;
  const capacityMax = input.capacityMax ?? current?.capacityMax;

  if (capacityMax !== undefined && capacityMax <= 0) {
    throw new LocationsServiceError(
      ERROR_CODES.invalidCapacityRange,
      400,
      "capacityMax must be greater than zero.",
      {
        capacityMax
      }
    );
  }

  if (
    capacityMin !== undefined &&
    capacityMax !== undefined &&
    capacityMax < capacityMin
  ) {
    throw new LocationsServiceError(
      ERROR_CODES.invalidCapacityRange,
      400,
      "capacityMax must be greater than or equal to capacityMin.",
      {
        capacityMin,
        capacityMax
      }
    );
  }
}

function buildDuplicateDetails(input: DuplicateCheckInput, conflictingRecord: ScopedLocationMatch) {
  return {
    entityType: input.entityType,
    scope: input.scope ?? null,
    conflictingRecordId: conflictingRecord.id,
    conflictingRecordName: conflictingRecord.name,
    conflictingRecordCode: conflictingRecord.code
  };
}

function assertNoNameConflict(input: DuplicateCheckInput, matches: ScopedLocationMatch[]) {
  const normalizedName = normalizeComparableText(input.name);

  if (!normalizedName) {
    return;
  }

  const conflictingRecord = matches.find(
    (match) => match.name.toLowerCase() === normalizedName.toLowerCase()
  );

  if (!conflictingRecord) {
    return;
  }

  throwTypedValidationError(
    ERROR_CODES.duplicateLocationName,
    `A ${input.entityType} with the same name already exists in this scope.`,
    buildDuplicateDetails(input, conflictingRecord)
  );
}

function assertNoCodeConflict(input: DuplicateCheckInput, matches: ScopedLocationMatch[]) {
  const normalizedCode = normalizeComparableText(input.code);

  if (!normalizedCode) {
    return;
  }

  const conflictingRecord = matches.find(
    (match) => match.code?.toLowerCase() === normalizedCode.toLowerCase()
  );

  if (!conflictingRecord) {
    return;
  }

  throwTypedValidationError(
    ERROR_CODES.duplicateLocationCode,
    `A ${input.entityType} with the same code already exists in this scope.`,
    buildDuplicateDetails(input, conflictingRecord)
  );
}

async function assertNoGovernorateDuplicates(input: {
  name?: string | null;
  code?: string | null;
  excludeId?: string;
}) {
  const name = normalizeComparableText(input.name);
  const code = normalizeComparableText(input.code);

  if (!name && !code) {
    return;
  }

  const matches = await db.governorate.findMany({
    where: {
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        ...(name
          ? [
              {
                name: {
                  equals: name,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(code
          ? [
              {
                code: {
                  equals: code,
                  mode: "insensitive" as const
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true
    }
  });

  assertNoNameConflict({ entityType: "governorate", name, code, excludeId: input.excludeId }, matches);
  assertNoCodeConflict({ entityType: "governorate", name, code, excludeId: input.excludeId }, matches);
}

async function assertNoUniversityDuplicates(input: {
  governorateId: string;
  name?: string | null;
  code?: string | null;
  excludeId?: string;
}) {
  const name = normalizeComparableText(input.name);
  const code = normalizeComparableText(input.code);

  if (!name && !code) {
    return;
  }

  const matches = await db.university.findMany({
    where: {
      governorateId: input.governorateId,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        ...(name
          ? [
              {
                name: {
                  equals: name,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(code
          ? [
              {
                code: {
                  equals: code,
                  mode: "insensitive" as const
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true
    }
  });

  assertNoNameConflict(
    {
      entityType: "university",
      name,
      code,
      excludeId: input.excludeId,
      scope: { governorateId: input.governorateId }
    },
    matches
  );
  assertNoCodeConflict(
    {
      entityType: "university",
      name,
      code,
      excludeId: input.excludeId,
      scope: { governorateId: input.governorateId }
    },
    matches
  );
}

async function assertNoBuildingDuplicates(input: {
  universityId: string;
  name?: string | null;
  code?: string | null;
  excludeId?: string;
}) {
  const name = normalizeComparableText(input.name);
  const code = normalizeComparableText(input.code);

  if (!name && !code) {
    return;
  }

  const matches = await db.building.findMany({
    where: {
      universityId: input.universityId,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        ...(name
          ? [
              {
                name: {
                  equals: name,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(code
          ? [
              {
                code: {
                  equals: code,
                  mode: "insensitive" as const
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true
    }
  });

  assertNoNameConflict(
    {
      entityType: "building",
      name,
      code,
      excludeId: input.excludeId,
      scope: { universityId: input.universityId }
    },
    matches
  );
  assertNoCodeConflict(
    {
      entityType: "building",
      name,
      code,
      excludeId: input.excludeId,
      scope: { universityId: input.universityId }
    },
    matches
  );
}

async function assertNoFloorDuplicates(input: {
  buildingId: string;
  name?: string | null;
  code?: string | null;
  excludeId?: string;
}) {
  const name = normalizeComparableText(input.name);
  const code = normalizeComparableText(input.code);

  if (!name && !code) {
    return;
  }

  const matches = await db.floor.findMany({
    where: {
      buildingId: input.buildingId,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        ...(name
          ? [
              {
                name: {
                  equals: name,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(code
          ? [
              {
                code: {
                  equals: code,
                  mode: "insensitive" as const
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true
    }
  });

  assertNoNameConflict(
    {
      entityType: "floor",
      name,
      code,
      excludeId: input.excludeId,
      scope: { buildingId: input.buildingId }
    },
    matches
  );
  assertNoCodeConflict(
    {
      entityType: "floor",
      name,
      code,
      excludeId: input.excludeId,
      scope: { buildingId: input.buildingId }
    },
    matches
  );
}

async function assertNoRoomDuplicates(input: {
  floorId: string;
  name?: string | null;
  code?: string | null;
  excludeId?: string;
}) {
  const name = normalizeComparableText(input.name);
  const code = normalizeComparableText(input.code);

  if (!name && !code) {
    return;
  }

  const matches = await db.room.findMany({
    where: {
      floorId: input.floorId,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      OR: [
        ...(name
          ? [
              {
                name: {
                  equals: name,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(code
          ? [
              {
                code: {
                  equals: code,
                  mode: "insensitive" as const
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true
    }
  });

  assertNoNameConflict(
    {
      entityType: "room",
      name,
      code,
      excludeId: input.excludeId,
      scope: { floorId: input.floorId }
    },
    matches
  );
  assertNoCodeConflict(
    {
      entityType: "room",
      name,
      code,
      excludeId: input.excludeId,
      scope: { floorId: input.floorId }
    },
    matches
  );
}

async function assertNoActiveChildren(params: {
  entityType: "governorate" | "university" | "building" | "floor";
  entityId: string;
  childType: "university" | "building" | "floor" | "room";
}) {
  const activeChildren =
    params.entityType === "governorate"
      ? await db.university.count({
          where: {
            governorateId: params.entityId,
            isActive: true
          }
        })
      : params.entityType === "university"
        ? await db.building.count({
            where: {
              universityId: params.entityId,
              isActive: true
            }
          })
        : params.entityType === "building"
          ? await db.floor.count({
              where: {
                buildingId: params.entityId,
                isActive: true
              }
            })
          : await db.room.count({
              where: {
                floorId: params.entityId,
                isActive: true
              }
            });

  if (activeChildren > 0) {
    throw new LocationsServiceError(
      ERROR_CODES.hasActiveChildren,
      409,
      "Cannot deactivate a location while it still has active child records.",
      {
        entityType: params.entityType,
        entityId: params.entityId,
        childType: params.childType,
        activeChildren
      }
    );
  }
}

async function assertGovernorateExists(
  governorateId: string,
  options: IncludeInactiveOptions = {}
) {
  const governorate = await db.governorate.findUnique({
    where: {
      id: governorateId
    },
    select: {
      id: true,
      name: true,
      nameEn: true,
      isActive: true
    }
  });

  if (!governorate) {
    throw new LocationsServiceError(
      ERROR_CODES.governorateNotFound,
      404,
      "Governorate not found."
    );
  }

  if (!options.includeInactive && !governorate.isActive) {
    throw new LocationsServiceError(
      ERROR_CODES.governorateNotFound,
      404,
      "Governorate not found."
    );
  }

  if (options.requireActiveParent && !governorate.isActive) {
    throw new LocationsServiceError(
      ERROR_CODES.inactiveParent,
      409,
      "Cannot attach records to an inactive governorate."
    );
  }

  return governorate;
}

async function assertUniversityExists(
  universityId: string,
  options: IncludeInactiveOptions = {}
) {
  const university = await db.university.findUnique({
    where: {
      id: universityId
    },
    select: {
      id: true,
      name: true,
      nameEn: true,
      governorateId: true,
      isActive: true
    }
  });

  if (!university) {
    throw new LocationsServiceError(
      ERROR_CODES.universityNotFound,
      404,
      "University not found."
    );
  }

  if (!options.includeInactive && !university.isActive) {
    throw new LocationsServiceError(
      ERROR_CODES.universityNotFound,
      404,
      "University not found."
    );
  }

  if (options.requireActiveParent && !university.isActive) {
    throw new LocationsServiceError(
      ERROR_CODES.inactiveParent,
      409,
      "Cannot attach records to an inactive university."
    );
  }

  return university;
}

async function assertBuildingExists(
  buildingId: string,
  options: IncludeInactiveOptions = {}
) {
  const building = await db.building.findUnique({
    where: {
      id: buildingId
    },
    select: {
      id: true,
      name: true,
      nameEn: true,
      universityId: true,
      isActive: true
    }
  });

  if (!building) {
    throw new LocationsServiceError(
      ERROR_CODES.buildingNotFound,
      404,
      "Building not found."
    );
  }

  if (!options.includeInactive && !building.isActive) {
    throw new LocationsServiceError(
      ERROR_CODES.buildingNotFound,
      404,
      "Building not found."
    );
  }

  if (options.requireActiveParent && !building.isActive) {
    throw new LocationsServiceError(
      ERROR_CODES.inactiveParent,
      409,
      "Cannot attach records to an inactive building."
    );
  }

  return building;
}

async function assertFloorExists(
  floorId: string,
  options: IncludeInactiveOptions = {}
) {
  const floor = await db.floor.findUnique({
    where: {
      id: floorId
    },
    select: {
      id: true,
      name: true,
      nameEn: true,
      buildingId: true,
      isActive: true
    }
  });

  if (!floor) {
    throw new LocationsServiceError(ERROR_CODES.floorNotFound, 404, "Floor not found.");
  }

  if (!options.includeInactive && !floor.isActive) {
    throw new LocationsServiceError(ERROR_CODES.floorNotFound, 404, "Floor not found.");
  }

  if (options.requireActiveParent && !floor.isActive) {
    throw new LocationsServiceError(
      ERROR_CODES.inactiveParent,
      409,
      "Cannot attach records to an inactive floor."
    );
  }

  return floor;
}

async function assertRoomExists(roomId: string, options: IncludeInactiveOptions = {}) {
  const room = await db.room.findUnique({
    where: {
      id: roomId
    },
    select: roomSelect
  });

  if (!room) {
    throw new LocationsServiceError(ERROR_CODES.roomNotFound, 404, "Room not found.");
  }

  if (!options.includeInactive && !room.isActive) {
    throw new LocationsServiceError(ERROR_CODES.roomNotFound, 404, "Room not found.");
  }

  return room;
}

async function recordLocationActivity(
  client: Prisma.TransactionClient,
  params: {
  actorAppUserId: string;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  description: string;
  beforePayload?: unknown;
  afterPayload?: unknown;
  metadata?: Record<string, unknown>;
}) {
  await logActivity({
    client,
    userId: params.actorAppUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
    metadata: params.metadata,
    beforePayload: params.beforePayload,
    afterPayload: params.afterPayload
  });
}

export async function listGovernorates(query: GovernorateListQuery) {
  const pagination = resolvePagination(query);
  const where = {
    ...createActiveFilter(query.includeInactive),
    ...createSearchFilter(query.search)
  } satisfies Prisma.GovernorateWhereInput;
  const [data, total] = await Promise.all([
    db.governorate.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: governorateSelect
    }),
    db.governorate.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getGovernorate(
  governorateId: string,
  options: IncludeInactiveOptions = {}
) {
  await assertGovernorateExists(governorateId, options);

  return db.governorate.findUniqueOrThrow({
    where: {
      id: governorateId
    },
    select: governorateSelect
  });
}

export async function createGovernorate(input: CreateGovernorateInput, actorAppUserId: string) {
  await assertNoGovernorateDuplicates({
    name: input.name,
    code: input.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.governorate.create({
        data: input,
        select: governorateSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "create",
        entityType: "governorate",
        entityId: created.id,
        description: `Created governorate ${created.name}.`,
        metadata: {
          code: created.code,
          isActive: created.isActive
        },
        afterPayload: created
      });

      return created;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateGovernorate(
  governorateId: string,
  input: UpdateGovernorateInput,
  actorAppUserId: string
) {
  const before = await getGovernorate(governorateId);

  if (input.isActive === false && before.isActive) {
    await assertNoActiveChildren({
      entityType: "governorate",
      entityId: governorateId,
      childType: "university"
    });
  }

  await assertNoGovernorateDuplicates({
    excludeId: governorateId,
    name: input.name ?? before.name,
    code: input.code ?? before.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.governorate.update({
        where: {
          id: governorateId
        },
        data: input,
        select: governorateSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "update",
        entityType: "governorate",
        entityId: updated.id,
        description: `Updated governorate ${updated.name}.`,
        metadata: {
          changedFields: Object.keys(input)
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateGovernorate(governorateId: string, actorAppUserId: string) {
  const before = await getGovernorate(governorateId, {
    includeInactive: true
  });

  if (before.isActive) {
    await assertNoActiveChildren({
      entityType: "governorate",
      entityId: governorateId,
      childType: "university"
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.governorate.update({
        where: {
          id: governorateId
        },
        data: {
          isActive: false
        },
        select: governorateSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "delete",
        entityType: "governorate",
        entityId: updated.id,
        description: `Deactivated governorate ${updated.name}.`,
        metadata: {
          softDeleted: true
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function listUniversities(query: UniversityListQuery) {
  if (query.governorateId) {
    await assertGovernorateExists(query.governorateId);
  }

  const pagination = resolvePagination(query);
  const where = {
    ...(query.governorateId
      ? {
          governorateId: query.governorateId
        }
      : {}),
    ...createActiveFilter(query.includeInactive),
    ...createSearchFilter(query.search)
  } satisfies Prisma.UniversityWhereInput;
  const [data, total] = await Promise.all([
    db.university.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: universitySelect
    }),
    db.university.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getUniversity(
  universityId: string,
  options: IncludeInactiveOptions = {}
) {
  await assertUniversityExists(universityId, options);

  return db.university.findUniqueOrThrow({
    where: {
      id: universityId
    },
    select: universitySelect
  });
}

export async function createUniversity(input: CreateUniversityInput, actorAppUserId: string) {
  await assertGovernorateExists(input.governorateId, {
    requireActiveParent: true
  });
  await assertNoUniversityDuplicates({
    governorateId: input.governorateId,
    name: input.name,
    code: input.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.university.create({
        data: input,
        select: universitySelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "create",
        entityType: "university",
        entityId: created.id,
        description: `Created university ${created.name}.`,
        metadata: {
          governorateId: created.governorateId,
          code: created.code,
          isActive: created.isActive
        },
        afterPayload: created
      });

      return created;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateUniversity(
  universityId: string,
  input: UpdateUniversityInput,
  actorAppUserId: string
) {
  const before = await getUniversity(universityId, {
    includeInactive: true
  });

  if (input.governorateId) {
    await assertGovernorateExists(input.governorateId, {
      requireActiveParent: true
    });
  }

  if (input.isActive === false && before.isActive) {
    await assertNoActiveChildren({
      entityType: "university",
      entityId: universityId,
      childType: "building"
    });
  }

  if (input.isActive === true && !before.isActive) {
    await assertGovernorateExists(input.governorateId ?? before.governorateId, {
      requireActiveParent: true
    });
  }

  await assertNoUniversityDuplicates({
    governorateId: input.governorateId ?? before.governorateId,
    excludeId: universityId,
    name: input.name ?? before.name,
    code: input.code ?? before.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.university.update({
        where: {
          id: universityId
        },
        data: input,
        select: universitySelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "update",
        entityType: "university",
        entityId: updated.id,
        description: `Updated university ${updated.name}.`,
        metadata: {
          changedFields: Object.keys(input)
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateUniversity(universityId: string, actorAppUserId: string) {
  const before = await getUniversity(universityId, {
    includeInactive: true
  });

  if (before.isActive) {
    await assertNoActiveChildren({
      entityType: "university",
      entityId: universityId,
      childType: "building"
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.university.update({
        where: {
          id: universityId
        },
        data: {
          isActive: false
        },
        select: universitySelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "delete",
        entityType: "university",
        entityId: updated.id,
        description: `Deactivated university ${updated.name}.`,
        metadata: {
          softDeleted: true,
          governorateId: updated.governorateId
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function listBuildings(query: BuildingListQuery) {
  if (query.universityId) {
    await assertUniversityExists(query.universityId);
  }

  const pagination = resolvePagination(query);
  const where = {
    ...(query.universityId
      ? {
          universityId: query.universityId
        }
      : {}),
    ...createActiveFilter(query.includeInactive),
    ...createSearchFilter(query.search)
  } satisfies Prisma.BuildingWhereInput;
  const [data, total] = await Promise.all([
    db.building.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: buildingSelect
    }),
    db.building.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getBuilding(
  buildingId: string,
  options: IncludeInactiveOptions = {}
) {
  await assertBuildingExists(buildingId, options);

  return db.building.findUniqueOrThrow({
    where: {
      id: buildingId
    },
    select: buildingSelect
  });
}

export async function createBuilding(input: CreateBuildingInput, actorAppUserId: string) {
  await assertUniversityExists(input.universityId, {
    requireActiveParent: true
  });
  await assertNoBuildingDuplicates({
    universityId: input.universityId,
    name: input.name,
    code: input.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.building.create({
        data: input,
        select: buildingSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "create",
        entityType: "building",
        entityId: created.id,
        description: `Created building ${created.name}.`,
        metadata: {
          universityId: created.universityId,
          code: created.code,
          isActive: created.isActive
        },
        afterPayload: created
      });

      return created;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateBuilding(
  buildingId: string,
  input: UpdateBuildingInput,
  actorAppUserId: string
) {
  const before = await getBuilding(buildingId, {
    includeInactive: true
  });

  if (input.universityId) {
    await assertUniversityExists(input.universityId, {
      requireActiveParent: true
    });
  }

  if (input.isActive === false && before.isActive) {
    await assertNoActiveChildren({
      entityType: "building",
      entityId: buildingId,
      childType: "floor"
    });
  }

  if (input.isActive === true && !before.isActive) {
    await assertUniversityExists(input.universityId ?? before.universityId, {
      requireActiveParent: true
    });
  }

  await assertNoBuildingDuplicates({
    universityId: input.universityId ?? before.universityId,
    excludeId: buildingId,
    name: input.name ?? before.name,
    code: input.code ?? before.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.building.update({
        where: {
          id: buildingId
        },
        data: input,
        select: buildingSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "update",
        entityType: "building",
        entityId: updated.id,
        description: `Updated building ${updated.name}.`,
        metadata: {
          changedFields: Object.keys(input)
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateBuilding(buildingId: string, actorAppUserId: string) {
  const before = await getBuilding(buildingId, {
    includeInactive: true
  });

  if (before.isActive) {
    await assertNoActiveChildren({
      entityType: "building",
      entityId: buildingId,
      childType: "floor"
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.building.update({
        where: {
          id: buildingId
        },
        data: {
          isActive: false
        },
        select: buildingSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "delete",
        entityType: "building",
        entityId: updated.id,
        description: `Deactivated building ${updated.name}.`,
        metadata: {
          softDeleted: true,
          universityId: updated.universityId
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function listFloors(query: FloorListQuery) {
  if (query.buildingId) {
    await assertBuildingExists(query.buildingId);
  }

  const pagination = resolvePagination(query);
  const where = {
    ...(query.buildingId
      ? {
          buildingId: query.buildingId
        }
      : {}),
    ...createActiveFilter(query.includeInactive),
    ...createSearchFilter(query.search)
  } satisfies Prisma.FloorWhereInput;
  const [data, total] = await Promise.all([
    db.floor.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { levelNumber: "asc" }, { name: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: floorSelect
    }),
    db.floor.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getFloor(
  floorId: string,
  options: IncludeInactiveOptions = {}
) {
  await assertFloorExists(floorId, options);

  return db.floor.findUniqueOrThrow({
    where: {
      id: floorId
    },
    select: floorSelect
  });
}

export async function createFloor(input: CreateFloorInput, actorAppUserId: string) {
  await assertBuildingExists(input.buildingId, {
    requireActiveParent: true
  });
  await assertNoFloorDuplicates({
    buildingId: input.buildingId,
    name: input.name,
    code: input.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.floor.create({
        data: input,
        select: floorSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "create",
        entityType: "floor",
        entityId: created.id,
        description: `Created floor ${created.name}.`,
        metadata: {
          buildingId: created.buildingId,
          levelNumber: created.levelNumber,
          isActive: created.isActive
        },
        afterPayload: created
      });

      return created;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateFloor(
  floorId: string,
  input: UpdateFloorInput,
  actorAppUserId: string
) {
  const before = await getFloor(floorId, {
    includeInactive: true
  });

  if (input.buildingId) {
    await assertBuildingExists(input.buildingId, {
      requireActiveParent: true
    });
  }

  if (input.isActive === false && before.isActive) {
    await assertNoActiveChildren({
      entityType: "floor",
      entityId: floorId,
      childType: "room"
    });
  }

  if (input.isActive === true && !before.isActive) {
    await assertBuildingExists(input.buildingId ?? before.buildingId, {
      requireActiveParent: true
    });
  }

  await assertNoFloorDuplicates({
    buildingId: input.buildingId ?? before.buildingId,
    excludeId: floorId,
    name: input.name ?? before.name,
    code: input.code ?? before.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.floor.update({
        where: {
          id: floorId
        },
        data: input,
        select: floorSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "update",
        entityType: "floor",
        entityId: updated.id,
        description: `Updated floor ${updated.name}.`,
        metadata: {
          changedFields: Object.keys(input)
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateFloor(floorId: string, actorAppUserId: string) {
  const before = await getFloor(floorId, {
    includeInactive: true
  });

  if (before.isActive) {
    await assertNoActiveChildren({
      entityType: "floor",
      entityId: floorId,
      childType: "room"
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.floor.update({
        where: {
          id: floorId
        },
        data: {
          isActive: false
        },
        select: floorSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "delete",
        entityType: "floor",
        entityId: updated.id,
        description: `Deactivated floor ${updated.name}.`,
        metadata: {
          softDeleted: true,
          buildingId: updated.buildingId
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function listRooms(query: RoomListQuery) {
  if (query.floorId) {
    await assertFloorExists(query.floorId);
  }

  const pagination = resolvePagination(query);
  const where = {
    ...(query.floorId
      ? {
          floorId: query.floorId
        }
      : {}),
    ...createActiveFilter(query.includeInactive),
    ...createSearchFilter(query.search)
  } satisfies Prisma.RoomWhereInput;
  const [data, total] = await Promise.all([
    db.room.findMany({
      where,
      orderBy: [{ name: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: roomSelect
    }),
    db.room.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getRoom(roomId: string, options: IncludeInactiveOptions = {}) {
  return assertRoomExists(roomId, options);
}

export async function createRoom(input: CreateRoomInput, actorAppUserId: string) {
  await assertFloorExists(input.floorId, {
    requireActiveParent: true
  });
  validateRoomIntegrity(input);
  await assertNoRoomDuplicates({
    floorId: input.floorId,
    name: input.name,
    code: input.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          ...input,
          supportedExamTypes: input.supportedExamTypes as ExamType[]
        },
        select: roomSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "create",
        entityType: "room",
        entityId: created.id,
        description: `Created room ${created.name}.`,
        metadata: {
          floorId: created.floorId,
          supportedExamTypes: created.supportedExamTypes,
          capacityMin: created.capacityMin,
          capacityMax: created.capacityMax,
          isActive: created.isActive
        },
        afterPayload: created
      });

      return created;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateRoom(
  roomId: string,
  input: UpdateRoomInput,
  actorAppUserId: string
) {
  const before = await getRoom(roomId, {
    includeInactive: true
  });

  if (input.floorId) {
    await assertFloorExists(input.floorId, {
      requireActiveParent: true
    });
  }

  if (input.isActive === true && !before.isActive) {
    await assertFloorExists(input.floorId ?? before.floorId, {
      requireActiveParent: true
    });
  }

  validateRoomIntegrity(input, before);
  await assertNoRoomDuplicates({
    floorId: input.floorId ?? before.floorId,
    excludeId: roomId,
    name: input.name ?? before.name,
    code: input.code ?? before.code
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: {
          id: roomId
        },
        data: input,
        select: roomSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "update",
        entityType: "room",
        entityId: updated.id,
        description: `Updated room ${updated.name}.`,
        metadata: {
          changedFields: Object.keys(input)
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateRoom(roomId: string, actorAppUserId: string) {
  const before = await getRoom(roomId, {
    includeInactive: true
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: {
          id: roomId
        },
        data: {
          isActive: false
        },
        select: roomSelect
      });

      await recordLocationActivity(tx, {
        actorAppUserId,
        action: "delete",
        entityType: "room",
        entityId: updated.id,
        description: `Deactivated room ${updated.name}.`,
        metadata: {
          softDeleted: true,
          floorId: updated.floorId
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function getLocationsTree(includeInactive = false) {
  const relationFilter = includeInactive ? undefined : { isActive: true };

  return db.governorate.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      ...locationTreeSelect,
      universities: {
        ...(locationTreeSelect.universities as Prisma.UniversityFindManyArgs),
        where: relationFilter,
        select: {
          ...((locationTreeSelect.universities as Prisma.UniversityFindManyArgs).select ?? {}),
          buildings: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            where: relationFilter,
            select: {
              id: true,
              universityId: true,
              code: true,
              name: true,
              nameEn: true,
              address: true,
              sortOrder: true,
              isActive: true,
              notes: true,
              floors: {
                orderBy: [{ sortOrder: "asc" }, { levelNumber: "asc" }, { name: "asc" }],
                where: relationFilter,
                select: {
                  id: true,
                  buildingId: true,
                  code: true,
                  name: true,
                  nameEn: true,
                  levelNumber: true,
                  sortOrder: true,
                  isActive: true,
                  notes: true,
                  rooms: {
                    orderBy: [{ name: "asc" }],
                    where: relationFilter,
                    select: {
                      id: true,
                      floorId: true,
                      code: true,
                      name: true,
                      nameEn: true,
                      roomType: true,
                      supportedExamTypes: true,
                      capacityMin: true,
                      capacityMax: true,
                      isActive: true,
                      notes: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
}
