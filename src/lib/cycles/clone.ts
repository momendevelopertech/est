import {
  CloneMode,
  CycleStatus,
  Prisma,
  SessionStatus
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";

import { CyclesServiceError, getCycleById } from "./service";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

const sourceCycleSelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  status: true,
  startDate: true,
  endDate: true,
  notes: true,
  isActive: true,
  sessions: {
    where: {
      isActive: true
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      examType: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      buildings: {
        where: {
          isActive: true
        },
        select: {
          buildingId: true,
          notes: true
        }
      }
    }
  }
} satisfies Prisma.CycleSelect;

type SourceCycleRecord = Prisma.CycleGetPayload<{
  select: typeof sourceCycleSelect;
}>;

function normalizeDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function normalizeBuildingIds(buildingIds: string[]) {
  return Array.from(new Set(buildingIds));
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

function assertSourceCycleHasDateRange(sourceCycle: SourceCycleRecord) {
  if (!sourceCycle.startDate || !sourceCycle.endDate) {
    throw new CyclesServiceError(
      ERROR_CODES.invalidSource,
      409,
      "Source cycle is missing a valid date range.",
      {
        sourceCycleId: sourceCycle.id
      }
    );
  }
}

function assertSessionInsideCycleRange(input: {
  sourceSessionId: string;
  cycleId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  startDateTime: Date;
  endDateTime: Date;
}) {
  const sessionStartDate = normalizeDateOnly(input.startDateTime);
  const sessionEndDate = normalizeDateOnly(input.endDateTime);

  if (
    sessionStartDate.getTime() < input.cycleStartDate.getTime() ||
    sessionEndDate.getTime() > input.cycleEndDate.getTime()
  ) {
    throw new CyclesServiceError(
      ERROR_CODES.sessionOutsideCycleRange,
      409,
      "Cloned session timing falls outside the target cycle range.",
      {
        sourceSessionId: input.sourceSessionId,
        cycleId: input.cycleId,
        cycleStartDate: input.cycleStartDate,
        cycleEndDate: input.cycleEndDate,
        sessionStartDate,
        sessionEndDate
      }
    );
  }
}

function assertSessionInSingleDay(input: {
  sourceSessionId: string;
  startDateTime: Date;
  endDateTime: Date;
}) {
  const startDate = normalizeDateOnly(input.startDateTime);
  const endDate = normalizeDateOnly(input.endDateTime);

  if (startDate.getTime() === endDate.getTime()) {
    return;
  }

  throw new CyclesServiceError(
    ERROR_CODES.invalidDateRange,
    409,
    "Cloned session timing must stay within one calendar day.",
    {
      sourceSessionId: input.sourceSessionId,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime
    }
  );
}

function assertCloneableSessionShape(sourceCycleId: string, session: SourceCycleRecord["sessions"][number]) {
  if (!session.startsAt || !session.endsAt) {
    throw new CyclesServiceError(
      ERROR_CODES.invalidSource,
      409,
      "Source session timing is incomplete and cannot be cloned.",
      {
        sourceCycleId,
        sourceSessionId: session.id
      }
    );
  }

  if (session.startsAt.getTime() >= session.endsAt.getTime()) {
    throw new CyclesServiceError(
      ERROR_CODES.invalidSource,
      409,
      "Source session timing is invalid and cannot be cloned.",
      {
        sourceCycleId,
        sourceSessionId: session.id,
        startsAt: session.startsAt,
        endsAt: session.endsAt
      }
    );
  }

  if (session.buildings.length === 0) {
    throw new CyclesServiceError(
      ERROR_CODES.invalidSource,
      409,
      "Source session has no active buildings and cannot be cloned.",
      {
        sourceCycleId,
        sourceSessionId: session.id
      }
    );
  }
}

function deriveDayIndex(cycleStartDate: Date, sessionDate: Date) {
  return (
    Math.floor((sessionDate.getTime() - cycleStartDate.getTime()) / millisecondsPerDay) + 1
  );
}

function shiftDate(value: Date, offsetMilliseconds: number) {
  return new Date(value.getTime() + offsetMilliseconds);
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2002") {
    throw new CyclesServiceError(
      ERROR_CODES.uniqueConstraintViolation,
      409,
      "Cycle clone conflicts with an existing record.",
      error.meta ?? null
    );
  }

  throw error;
}

async function assertNoOverlappingCycles(
  client: Prisma.TransactionClient,
  input: {
    startDate: Date;
    endDate: Date;
  }
) {
  const overlappingCycles = await client.cycle.findMany({
    where: {
      isActive: true,
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

async function assertBuildingsAreActive(
  client: Prisma.TransactionClient,
  buildingIds: string[]
) {
  if (buildingIds.length === 0) {
    return;
  }

  const normalizedIds = normalizeBuildingIds(buildingIds);
  const activeBuildings = await client.building.findMany({
    where: {
      id: {
        in: normalizedIds
      },
      isActive: true
    },
    select: {
      id: true
    }
  });
  const activeBuildingIdSet = new Set(activeBuildings.map((building) => building.id));
  const inactiveOrMissing = normalizedIds.filter((buildingId) => !activeBuildingIdSet.has(buildingId));

  if (inactiveOrMissing.length > 0) {
    throw new CyclesServiceError(
      ERROR_CODES.inactiveParent,
      409,
      "Cannot clone sessions that reference inactive or missing buildings.",
      {
        buildingIds: inactiveOrMissing
      }
    );
  }
}

async function assertNoOverlappingSessions(
  client: Prisma.TransactionClient,
  input: {
    startDateTime: Date;
    endDateTime: Date;
    buildingIds: string[];
  }
) {
  const normalizedBuildingIds = normalizeBuildingIds(input.buildingIds);
  const sessionDate = normalizeDateOnly(input.startDateTime);
  const overlappingSessions = await client.session.findMany({
    where: {
      isActive: true,
      buildings: {
        some: {
          isActive: true,
          buildingId: {
            in: normalizedBuildingIds
          }
        }
      },
      OR: [
        {
          startsAt: {
            lt: input.endDateTime
          },
          endsAt: {
            gt: input.startDateTime
          }
        },
        {
          sessionDate,
          startsAt: null
        },
        {
          sessionDate,
          endsAt: null
        }
      ]
    },
    select: {
      id: true,
      name: true,
      nameEn: true,
      sessionDate: true,
      startsAt: true,
      endsAt: true,
      cycle: {
        select: {
          id: true,
          code: true,
          name: true,
          nameEn: true
        }
      },
      buildings: {
        where: {
          isActive: true,
          buildingId: {
            in: normalizedBuildingIds
          }
        },
        select: {
          buildingId: true,
          building: {
            select: {
              id: true,
              code: true,
              name: true,
              nameEn: true
            }
          }
        }
      }
    }
  });

  if (overlappingSessions.length > 0) {
    throw new CyclesServiceError(
      ERROR_CODES.overlappingSession,
      409,
      "Cloned session timing overlaps with an existing active session in the same building.",
      overlappingSessions
    );
  }
}

export type CloneCycleResult = {
  cycle: Awaited<ReturnType<typeof getCycleById>>;
  summary: {
    clonedCycleId: string;
    clonedSessionsCount: number;
    dateShiftDays: number;
    sourceCycleId: string;
  };
};

export type CloneCycleInput = {
  sourceCycleId: string;
  newStartDate: Date;
  newEndDate: Date;
  allowInactiveSource?: boolean;
};

export async function cloneCycle(
  input: CloneCycleInput,
  actorAppUserId: string
): Promise<CloneCycleResult> {
  const targetStartDate = normalizeDateOnly(input.newStartDate);
  const targetEndDate = normalizeDateOnly(input.newEndDate);
  assertValidDateRange(targetStartDate, targetEndDate);

  const sourceCycle = await db.cycle.findUnique({
    where: {
      id: input.sourceCycleId
    },
    select: sourceCycleSelect
  });

  if (!sourceCycle) {
    throw new CyclesServiceError(ERROR_CODES.cycleNotFound, 404, "Cycle not found.");
  }

  if (!input.allowInactiveSource && !sourceCycle.isActive) {
    throw new CyclesServiceError(
      ERROR_CODES.invalidSource,
      409,
      "Inactive cycles cannot be cloned without explicit override.",
      {
        sourceCycleId: sourceCycle.id
      }
    );
  }

  assertSourceCycleHasDateRange(sourceCycle);

  const sourceStartDate = normalizeDateOnly(sourceCycle.startDate!);
  const dateOffsetMilliseconds = targetStartDate.getTime() - sourceStartDate.getTime();
  const dateShiftDays = Math.round(dateOffsetMilliseconds / millisecondsPerDay);

  const allBuildingIds = normalizeBuildingIds(
    sourceCycle.sessions.flatMap((session) => session.buildings.map((building) => building.buildingId))
  );

  for (const session of sourceCycle.sessions) {
    assertCloneableSessionShape(sourceCycle.id, session);
  }

  try {
    const transactionResult = await db.$transaction(async (tx) => {
      await assertNoOverlappingCycles(tx, {
        startDate: targetStartDate,
        endDate: targetEndDate
      });

      await assertBuildingsAreActive(tx, allBuildingIds);

      const clonedCycle = await tx.cycle.create({
        data: {
          code: null,
          name: sourceCycle.name,
          nameEn: sourceCycle.nameEn ?? null,
          status: CycleStatus.DRAFT,
          startDate: targetStartDate,
          endDate: targetEndDate,
          sourceCycleId: sourceCycle.id,
          cloneMode: CloneMode.STRUCTURE_ONLY,
          notes: sourceCycle.notes ?? null,
          isActive: true
        },
        select: {
          id: true
        }
      });

      let clonedSessionsCount = 0;

      for (const sourceSession of sourceCycle.sessions) {
        const shiftedStartsAt = shiftDate(sourceSession.startsAt!, dateOffsetMilliseconds);
        const shiftedEndsAt = shiftDate(sourceSession.endsAt!, dateOffsetMilliseconds);
        const shiftedSessionDate = normalizeDateOnly(shiftedStartsAt);
        const normalizedBuildingIds = normalizeBuildingIds(
          sourceSession.buildings.map((building) => building.buildingId)
        );

        if (shiftedStartsAt.getTime() >= shiftedEndsAt.getTime()) {
          throw new CyclesServiceError(
            ERROR_CODES.invalidDateRange,
            409,
            "Cloned session timing became invalid after date shift.",
            {
              sourceSessionId: sourceSession.id,
              shiftedStartsAt,
              shiftedEndsAt
            }
          );
        }

        assertSessionInsideCycleRange({
          sourceSessionId: sourceSession.id,
          cycleId: clonedCycle.id,
          cycleStartDate: targetStartDate,
          cycleEndDate: targetEndDate,
          startDateTime: shiftedStartsAt,
          endDateTime: shiftedEndsAt
        });
        assertSessionInSingleDay({
          sourceSessionId: sourceSession.id,
          startDateTime: shiftedStartsAt,
          endDateTime: shiftedEndsAt
        });

        await assertNoOverlappingSessions(tx, {
          startDateTime: shiftedStartsAt,
          endDateTime: shiftedEndsAt,
          buildingIds: normalizedBuildingIds
        });

        const createdSession = await tx.session.create({
          data: {
            cycleId: clonedCycle.id,
            name: sourceSession.name,
            nameEn: sourceSession.nameEn ?? null,
            examType: sourceSession.examType,
            sessionDate: shiftedSessionDate,
            dayIndex: deriveDayIndex(targetStartDate, shiftedSessionDate),
            startsAt: shiftedStartsAt,
            endsAt: shiftedEndsAt,
            status: SessionStatus.DRAFT,
            lockedAt: null,
            notes: sourceSession.notes ?? null,
            isActive: true
          },
          select: {
            id: true
          }
        });

        await tx.sessionBuilding.createMany({
          data: sourceSession.buildings.map((building) => ({
            sessionId: createdSession.id,
            buildingId: building.buildingId,
            isActive: true,
            notes: building.notes ?? null
          }))
        });

        clonedSessionsCount += 1;
      }

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "clone",
        entityType: "cycle",
        entityId: clonedCycle.id,
        description: `Cloned cycle ${sourceCycle.name}.`,
        metadata: {
          sourceCycleId: sourceCycle.id,
          clonedSessionsCount,
          dateShiftDays,
          cloneMode: CloneMode.STRUCTURE_ONLY
        },
        beforePayload: {
          id: sourceCycle.id,
          name: sourceCycle.name,
          nameEn: sourceCycle.nameEn,
          startDate: sourceCycle.startDate,
          endDate: sourceCycle.endDate
        },
        afterPayload: {
          id: clonedCycle.id,
          startDate: targetStartDate,
          endDate: targetEndDate
        }
      });

      return {
        clonedCycleId: clonedCycle.id,
        clonedSessionsCount
      };
    });

    const clonedCycle = await getCycleById(transactionResult.clonedCycleId, {
      includeInactive: true
    });

    return {
      cycle: clonedCycle,
      summary: {
        clonedCycleId: transactionResult.clonedCycleId,
        clonedSessionsCount: transactionResult.clonedSessionsCount,
        dateShiftDays,
        sourceCycleId: sourceCycle.id
      }
    };
  } catch (error) {
    normalizeMutationError(error);
  }
}
