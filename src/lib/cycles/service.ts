import { CloneMode, CycleStatus, Prisma } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";
import { createBilingualSearchFilter } from "@/lib/search/bilingual";

import type { CreateCycleInput, CycleListQuery, UpdateCycleInput } from "./validation";

type IncludeInactiveOptions = {
  includeInactive?: boolean;
};

export class CyclesServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "CyclesServiceError";
  }
}

const cycleSelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  status: true,
  startDate: true,
  endDate: true,
  sourceCycleId: true,
  cloneMode: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  sourceCycle: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      code: true
    }
  },
  _count: {
    select: {
      sessions: true,
      waitingList: true,
      clonedCycles: true
    }
  }
} satisfies Prisma.CycleSelect;

function createSearchFilter(search?: string) {
  return createBilingualSearchFilter(search, ["code"]);
}

function createActiveFilter(includeInactive: boolean) {
  return includeInactive ? {} : { isActive: true };
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function resolveLocalizedName(input: { name?: string; nameEn?: string }) {
  const name = normalizeOptionalText(input.name);
  const nameEn = normalizeOptionalText(input.nameEn);
  const fallbackName = name ?? nameEn;

  if (!fallbackName) {
    throw new CyclesServiceError(
      ERROR_CODES.validationError,
      400,
      "Either name or nameEn is required.",
      {
        field: "name"
      }
    );
  }

  return {
    name: fallbackName,
    nameEn: nameEn ?? (!name ? fallbackName : undefined)
  };
}

function assertValidDateRange(startDate?: Date | null, endDate?: Date | null) {
  if (!startDate || !endDate) {
    throw new CyclesServiceError(
      ERROR_CODES.invalidDateRange,
      400,
      "startDate and endDate are required."
    );
  }

  if (startDate.getTime() >= endDate.getTime()) {
    throw new CyclesServiceError(
      ERROR_CODES.invalidDateRange,
      400,
      "startDate must be earlier than endDate.",
      {
        startDate,
        endDate
      }
    );
  }
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2025") {
    throw new CyclesServiceError(ERROR_CODES.cycleNotFound, 404, "Cycle not found.");
  }

  if (isKnownPrismaError(error) && error.code === "P2002") {
    throw new CyclesServiceError(
      ERROR_CODES.uniqueConstraintViolation,
      409,
      "The requested cycle change conflicts with an existing record.",
      error.meta ?? null
    );
  }

  throw error;
}

async function assertCycleExists(cycleId: string, options: IncludeInactiveOptions = {}) {
  const cycle = await db.cycle.findUnique({
    where: {
      id: cycleId
    },
    select: cycleSelect
  });

  if (!cycle || (!options.includeInactive && !cycle.isActive)) {
    throw new CyclesServiceError(ERROR_CODES.cycleNotFound, 404, "Cycle not found.");
  }

  return cycle;
}

async function assertNoOverlappingCycles(input: {
  startDate: Date;
  endDate: Date;
  excludeId?: string;
}) {
  const overlappingCycles = await db.cycle.findMany({
    where: {
      isActive: true,
      ...(input.excludeId
        ? {
            id: {
              not: input.excludeId
            }
          }
        : {}),
      startDate: {
        lte: input.endDate
      },
      endDate: {
        gte: input.startDate
      }
    },
    select: {
      id: true,
      code: true,
      name: true,
      nameEn: true,
      startDate: true,
      endDate: true
    }
  });

  if (overlappingCycles.length > 0) {
    throw new CyclesServiceError(
      ERROR_CODES.overlappingCycle,
      409,
      "Cycle dates overlap with an existing active cycle.",
      overlappingCycles
    );
  }
}

function buildCreateData(input: CreateCycleInput) {
  const localizedName = resolveLocalizedName(input);
  const startDate = normalizeDateOnly(input.startDate);
  const endDate = normalizeDateOnly(input.endDate);
  assertValidDateRange(startDate, endDate);

  return {
    code: normalizeOptionalText(input.code),
    name: localizedName.name,
    nameEn: localizedName.nameEn ?? null,
    status: input.status ?? CycleStatus.DRAFT,
    startDate,
    endDate,
    sourceCycleId: input.sourceCycleId ?? null,
    cloneMode: input.cloneMode ?? null,
    notes: normalizeOptionalText(input.notes) ?? null,
    isActive: input.isActive ?? true
  } satisfies Prisma.CycleUncheckedCreateInput;
}

function buildUpdateData(current: Awaited<ReturnType<typeof assertCycleExists>>, input: UpdateCycleInput) {
  const localizedName = resolveLocalizedName({
    name: input.name ?? current.name,
    nameEn: input.nameEn ?? current.nameEn ?? undefined
  });
  const startDate = normalizeDateOnly(input.startDate ?? current.startDate ?? new Date(NaN));
  const endDate = normalizeDateOnly(input.endDate ?? current.endDate ?? new Date(NaN));
  assertValidDateRange(startDate, endDate);

  return {
    ...(input.code !== undefined ? { code: normalizeOptionalText(input.code) ?? null } : {}),
    ...(input.name !== undefined || input.nameEn !== undefined
      ? {
          name: localizedName.name,
          nameEn: localizedName.nameEn ?? null
        }
      : {}),
    ...(input.status !== undefined ? { status: input.status as CycleStatus } : {}),
    ...(input.startDate !== undefined ? { startDate } : {}),
    ...(input.endDate !== undefined ? { endDate } : {}),
    ...(input.sourceCycleId !== undefined ? { sourceCycleId: input.sourceCycleId ?? null } : {}),
    ...(input.cloneMode !== undefined ? { cloneMode: (input.cloneMode as CloneMode) ?? null } : {}),
    ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) ?? null } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
  } satisfies Prisma.CycleUncheckedUpdateInput;
}

export async function listCycles(query: CycleListQuery) {
  const pagination = resolvePagination(query);
  const where = {
    ...createActiveFilter(query.includeInactive),
    ...createSearchFilter(query.search)
  } satisfies Prisma.CycleWhereInput;
  const [data, total] = await Promise.all([
    db.cycle.findMany({
      where,
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: cycleSelect
    }),
    db.cycle.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getCycleById(cycleId: string, options: IncludeInactiveOptions = {}) {
  return assertCycleExists(cycleId, options);
}

export async function createCycle(input: CreateCycleInput, actorAppUserId: string) {
  const data = buildCreateData(input);
  await assertNoOverlappingCycles({
    startDate: data.startDate!,
    endDate: data.endDate!
  });

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.cycle.create({
        data,
        select: cycleSelect
      });

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "create",
        entityType: "cycle",
        entityId: created.id,
        description: `Created cycle ${created.name}.`,
        metadata: {
          code: created.code,
          status: created.status,
          startDate: created.startDate,
          endDate: created.endDate
        },
        afterPayload: created
      });

      return created;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateCycle(
  cycleId: string,
  input: UpdateCycleInput,
  actorAppUserId: string
) {
  const before = await getCycleById(cycleId, {
    includeInactive: true
  });
  const data = buildUpdateData(before, input);
  const nextStartDate =
    (data.startDate as Date | undefined) ?? before.startDate ?? undefined;
  const nextEndDate = (data.endDate as Date | undefined) ?? before.endDate ?? undefined;

  assertValidDateRange(nextStartDate, nextEndDate);
  await assertNoOverlappingCycles({
    startDate: nextStartDate!,
    endDate: nextEndDate!,
    excludeId: cycleId
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.cycle.update({
        where: {
          id: cycleId
        },
        data,
        select: cycleSelect
      });

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "update",
        entityType: "cycle",
        entityId: updated.id,
        description: `Updated cycle ${updated.name}.`,
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

export async function deleteCycle(cycleId: string, actorAppUserId: string) {
  const before = await getCycleById(cycleId, {
    includeInactive: true
  });

  if (before._count.sessions > 0 || before._count.waitingList > 0) {
    throw new CyclesServiceError(
      ERROR_CODES.hasRelatedRecords,
      409,
      "Cannot deactivate a cycle while it still has related records.",
      {
        cycleId,
        sessions: before._count.sessions,
        waitingList: before._count.waitingList
      }
    );
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.cycle.update({
        where: {
          id: cycleId
        },
        data: {
          isActive: false
        },
        select: cycleSelect
      });

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "delete",
        entityType: "cycle",
        entityId: updated.id,
        description: `Deactivated cycle ${updated.name}.`,
        metadata: {
          softDeleted: true,
          status: updated.status
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
