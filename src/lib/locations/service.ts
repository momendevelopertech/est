import { Prisma, type ExamType } from "@prisma/client";

import { db } from "@/lib/db";

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

function createSearchFilter(search?: string) {
  if (!search) {
    return undefined;
  }

  return {
    OR: [
      {
        name: {
          contains: search,
          mode: "insensitive" as const
        }
      },
      {
        nameEn: {
          contains: search,
          mode: "insensitive" as const
        }
      },
      {
        code: {
          contains: search,
          mode: "insensitive" as const
        }
      }
    ]
  };
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
    "unique_constraint_violation",
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
    throw new LocationsServiceError("location_not_found", 404, "The requested location was not found.");
  }

  throw error;
}

async function assertGovernorateExists(governorateId: string) {
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
    throw new LocationsServiceError("governorate_not_found", 404, "Governorate not found.");
  }

  return governorate;
}

async function assertUniversityExists(universityId: string) {
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
    throw new LocationsServiceError("university_not_found", 404, "University not found.");
  }

  return university;
}

async function assertBuildingExists(buildingId: string) {
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
    throw new LocationsServiceError("building_not_found", 404, "Building not found.");
  }

  return building;
}

async function assertFloorExists(floorId: string) {
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
    throw new LocationsServiceError("floor_not_found", 404, "Floor not found.");
  }

  return floor;
}

async function assertRoomExists(roomId: string) {
  const room = await db.room.findUnique({
    where: {
      id: roomId
    },
    select: roomSelect
  });

  if (!room) {
    throw new LocationsServiceError("room_not_found", 404, "Room not found.");
  }

  return room;
}

function createActivityLogEntry(params: {
  actorAppUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  beforePayload?: unknown;
  afterPayload?: unknown;
}) {
  return {
    actorAppUserId: params.actorAppUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
    beforePayload:
      params.beforePayload === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(params.beforePayload)) as Prisma.InputJsonValue),
    afterPayload:
      params.afterPayload === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(params.afterPayload)) as Prisma.InputJsonValue)
  };
}

export async function listGovernorates(query: GovernorateListQuery) {
  return db.governorate.findMany({
    where: {
      ...createActiveFilter(query.includeInactive),
      ...createSearchFilter(query.search)
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: governorateSelect
  });
}

export async function getGovernorate(governorateId: string) {
  await assertGovernorateExists(governorateId);

  return db.governorate.findUniqueOrThrow({
    where: {
      id: governorateId
    },
    select: governorateSelect
  });
}

export async function createGovernorate(input: CreateGovernorateInput, actorAppUserId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.governorate.create({
        data: input,
        select: governorateSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.governorates.create",
          entityType: "governorate",
          entityId: created.id,
          description: `Created governorate ${created.name}.`,
          afterPayload: created
        })
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

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.governorate.update({
        where: {
          id: governorateId
        },
        data: input,
        select: governorateSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.governorates.update",
          entityType: "governorate",
          entityId: updated.id,
          description: `Updated governorate ${updated.name}.`,
          beforePayload: before,
          afterPayload: updated
        })
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateGovernorate(governorateId: string, actorAppUserId: string) {
  return updateGovernorate(
    governorateId,
    {
      isActive: false
    },
    actorAppUserId
  );
}

export async function listUniversities(query: UniversityListQuery) {
  if (query.governorateId) {
    await assertGovernorateExists(query.governorateId);
  }

  return db.university.findMany({
    where: {
      ...(query.governorateId
        ? {
            governorateId: query.governorateId
          }
        : {}),
      ...createActiveFilter(query.includeInactive),
      ...createSearchFilter(query.search)
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: universitySelect
  });
}

export async function getUniversity(universityId: string) {
  await assertUniversityExists(universityId);

  return db.university.findUniqueOrThrow({
    where: {
      id: universityId
    },
    select: universitySelect
  });
}

export async function createUniversity(input: CreateUniversityInput, actorAppUserId: string) {
  await assertGovernorateExists(input.governorateId);

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.university.create({
        data: input,
        select: universitySelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.universities.create",
          entityType: "university",
          entityId: created.id,
          description: `Created university ${created.name}.`,
          afterPayload: created
        })
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
  if (input.governorateId) {
    await assertGovernorateExists(input.governorateId);
  }

  const before = await getUniversity(universityId);

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.university.update({
        where: {
          id: universityId
        },
        data: input,
        select: universitySelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.universities.update",
          entityType: "university",
          entityId: updated.id,
          description: `Updated university ${updated.name}.`,
          beforePayload: before,
          afterPayload: updated
        })
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateUniversity(universityId: string, actorAppUserId: string) {
  return updateUniversity(
    universityId,
    {
      isActive: false
    },
    actorAppUserId
  );
}

export async function listBuildings(query: BuildingListQuery) {
  if (query.universityId) {
    await assertUniversityExists(query.universityId);
  }

  return db.building.findMany({
    where: {
      ...(query.universityId
        ? {
            universityId: query.universityId
          }
        : {}),
      ...createActiveFilter(query.includeInactive),
      ...createSearchFilter(query.search)
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: buildingSelect
  });
}

export async function getBuilding(buildingId: string) {
  await assertBuildingExists(buildingId);

  return db.building.findUniqueOrThrow({
    where: {
      id: buildingId
    },
    select: buildingSelect
  });
}

export async function createBuilding(input: CreateBuildingInput, actorAppUserId: string) {
  await assertUniversityExists(input.universityId);

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.building.create({
        data: input,
        select: buildingSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.buildings.create",
          entityType: "building",
          entityId: created.id,
          description: `Created building ${created.name}.`,
          afterPayload: created
        })
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
  if (input.universityId) {
    await assertUniversityExists(input.universityId);
  }

  const before = await getBuilding(buildingId);

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.building.update({
        where: {
          id: buildingId
        },
        data: input,
        select: buildingSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.buildings.update",
          entityType: "building",
          entityId: updated.id,
          description: `Updated building ${updated.name}.`,
          beforePayload: before,
          afterPayload: updated
        })
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateBuilding(buildingId: string, actorAppUserId: string) {
  return updateBuilding(
    buildingId,
    {
      isActive: false
    },
    actorAppUserId
  );
}

export async function listFloors(query: FloorListQuery) {
  if (query.buildingId) {
    await assertBuildingExists(query.buildingId);
  }

  return db.floor.findMany({
    where: {
      ...(query.buildingId
        ? {
            buildingId: query.buildingId
          }
        : {}),
      ...createActiveFilter(query.includeInactive),
      ...createSearchFilter(query.search)
    },
    orderBy: [{ sortOrder: "asc" }, { levelNumber: "asc" }, { name: "asc" }],
    select: floorSelect
  });
}

export async function getFloor(floorId: string) {
  await assertFloorExists(floorId);

  return db.floor.findUniqueOrThrow({
    where: {
      id: floorId
    },
    select: floorSelect
  });
}

export async function createFloor(input: CreateFloorInput, actorAppUserId: string) {
  await assertBuildingExists(input.buildingId);

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.floor.create({
        data: input,
        select: floorSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.floors.create",
          entityType: "floor",
          entityId: created.id,
          description: `Created floor ${created.name}.`,
          afterPayload: created
        })
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
  if (input.buildingId) {
    await assertBuildingExists(input.buildingId);
  }

  const before = await getFloor(floorId);

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.floor.update({
        where: {
          id: floorId
        },
        data: input,
        select: floorSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.floors.update",
          entityType: "floor",
          entityId: updated.id,
          description: `Updated floor ${updated.name}.`,
          beforePayload: before,
          afterPayload: updated
        })
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateFloor(floorId: string, actorAppUserId: string) {
  return updateFloor(
    floorId,
    {
      isActive: false
    },
    actorAppUserId
  );
}

function validateRoomCapacity(
  input: { capacityMin?: number; capacityMax?: number },
  current?: { capacityMin: number; capacityMax: number }
) {
  const capacityMin = input.capacityMin ?? current?.capacityMin;
  const capacityMax = input.capacityMax ?? current?.capacityMax;

  if (
    capacityMin !== undefined &&
    capacityMax !== undefined &&
    capacityMax < capacityMin
  ) {
    throw new LocationsServiceError(
      "invalid_capacity_range",
      400,
      "capacityMax must be greater than or equal to capacityMin."
    );
  }
}

export async function listRooms(query: RoomListQuery) {
  if (query.floorId) {
    await assertFloorExists(query.floorId);
  }

  return db.room.findMany({
    where: {
      ...(query.floorId
        ? {
            floorId: query.floorId
          }
        : {}),
      ...createActiveFilter(query.includeInactive),
      ...createSearchFilter(query.search)
    },
    orderBy: [{ name: "asc" }],
    select: roomSelect
  });
}

export async function getRoom(roomId: string) {
  return assertRoomExists(roomId);
}

export async function createRoom(input: CreateRoomInput, actorAppUserId: string) {
  await assertFloorExists(input.floorId);
  validateRoomCapacity(input);

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          ...input,
          supportedExamTypes: input.supportedExamTypes as ExamType[]
        },
        select: roomSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.rooms.create",
          entityType: "room",
          entityId: created.id,
          description: `Created room ${created.name}.`,
          afterPayload: created
        })
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
  const before = await getRoom(roomId);

  if (input.floorId) {
    await assertFloorExists(input.floorId);
  }

  validateRoomCapacity(input, before);

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: {
          id: roomId
        },
        data: input,
        select: roomSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "locations.rooms.update",
          entityType: "room",
          entityId: updated.id,
          description: `Updated room ${updated.name}.`,
          beforePayload: before,
          afterPayload: updated
        })
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateRoom(roomId: string, actorAppUserId: string) {
  return updateRoom(
    roomId,
    {
      isActive: false
    },
    actorAppUserId
  );
}
