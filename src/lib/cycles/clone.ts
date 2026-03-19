import {
  CloneMode,
  CycleStatus,
  Prisma
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import {
  createSessionInTransaction,
  SessionsServiceError
} from "@/lib/sessions/service";

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

function shiftDate(value: Date, offsetMilliseconds: number) {
  return new Date(value.getTime() + offsetMilliseconds);
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeMutationError(error: unknown): never {
  if (error instanceof SessionsServiceError) {
    throw new CyclesServiceError(
      error.code,
      error.status,
      error.message,
      error.details
    );
  }

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

  for (const session of sourceCycle.sessions) {
    assertCloneableSessionShape(sourceCycle.id, session);
  }

  try {
    const transactionResult = await db.$transaction(
      async (tx) => {
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
          await createSessionInTransaction(tx, {
            cycleId: clonedCycle.id,
            name: sourceSession.name,
            nameEn: sourceSession.nameEn ?? undefined,
            examType: sourceSession.examType,
            startDateTime: shiftedStartsAt,
            endDateTime: shiftedEndsAt,
            buildingIds: sourceSession.buildings.map((building) => building.buildingId),
            notes: sourceSession.notes ?? undefined,
            isActive: true
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
            newCycleId: clonedCycle.id,
            sessionCount: clonedSessionsCount,
            userId: actorAppUserId,
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
      },
      {
        maxWait: 10000,
        timeout: 30000
      }
    );

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
