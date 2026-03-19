import { Prisma, SessionStatus, type PrismaClient } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";
import { createBilingualSearchFilter } from "@/lib/search/bilingual";
import {
  canTransitionSessionStatus,
  getDerivedSessionStatus
} from "@/lib/sessions/status";

import type {
  CreateSessionInput,
  SessionListQuery,
  UpdateSessionInput,
  UpdateSessionStatusInput
} from "./validation";

type ActivityClient = Prisma.TransactionClient | PrismaClient;

type IncludeInactiveOptions = {
  includeInactive?: boolean;
};

export class SessionsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "SessionsServiceError";
  }
}

const cycleSummarySelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  status: true,
  startDate: true,
  endDate: true,
  isActive: true
} satisfies Prisma.CycleSelect;

const buildingSummarySelect = {
  id: true,
  code: true,
  name: true,
  nameEn: true,
  isActive: true,
  universityId: true,
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
  }
} satisfies Prisma.BuildingSelect;

const sessionSelect = {
  id: true,
  cycleId: true,
  name: true,
  nameEn: true,
  examType: true,
  sessionDate: true,
  dayIndex: true,
  startsAt: true,
  endsAt: true,
  status: true,
  lockedAt: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  cycle: {
    select: cycleSummarySelect
  },
  buildings: {
    select: {
      id: true,
      buildingId: true,
      isActive: true,
      notes: true,
      building: {
        select: buildingSummarySelect
      }
    }
  },
  _count: {
    select: {
      assignments: true,
      buildings: true,
      evaluations: true,
      waitingList: true
    }
  }
} satisfies Prisma.SessionSelect;

type CycleRecord = Prisma.CycleGetPayload<{
  select: typeof cycleSummarySelect;
}>;

type BuildingRecord = Prisma.BuildingGetPayload<{
  select: typeof buildingSummarySelect;
}>;

type SessionRecord = Prisma.SessionGetPayload<{
  select: typeof sessionSelect;
}>;

function createSearchFilter(search?: string) {
  return createBilingualSearchFilter(search);
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
    throw new SessionsServiceError(
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

function normalizeBuildingIds(buildingIds: string[]) {
  return Array.from(new Set(buildingIds));
}

function assertHasBuildings(buildingIds: string[]) {
  if (buildingIds.length > 0) {
    return;
  }

  throw new SessionsServiceError(
    ERROR_CODES.validationError,
    400,
    "At least one building is required for a session.",
    {
      field: "buildingIds"
    }
  );
}

function deriveDayIndex(cycleStartDate: Date | null, sessionDate: Date) {
  if (!cycleStartDate) {
    return null;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return (
    Math.floor(
      (sessionDate.getTime() - normalizeDateOnly(cycleStartDate).getTime()) /
        millisecondsPerDay
    ) + 1
  );
}

function resolveLockedAt(params: {
  requestedLockedAt?: Date | null;
  status: SessionStatus;
  currentLockedAt?: Date | null;
}) {
  if (params.requestedLockedAt !== undefined) {
    return params.requestedLockedAt;
  }

  if (params.status === SessionStatus.LOCKED) {
    return params.currentLockedAt ?? new Date();
  }

  return null;
}

function assertValidDateRange(startDateTime?: Date | null, endDateTime?: Date | null) {
  if (!startDateTime || !endDateTime) {
    throw new SessionsServiceError(
      ERROR_CODES.invalidDateRange,
      400,
      "startDateTime and endDateTime are required."
    );
  }

  if (startDateTime.getTime() >= endDateTime.getTime()) {
    throw new SessionsServiceError(
      ERROR_CODES.invalidDateRange,
      400,
      "startDateTime must be earlier than endDateTime.",
      {
        startDateTime,
        endDateTime
      }
    );
  }

  const startDate = normalizeDateOnly(startDateTime);
  const endDate = normalizeDateOnly(endDateTime);

  if (startDate.getTime() !== endDate.getTime()) {
    throw new SessionsServiceError(
      ERROR_CODES.invalidDateRange,
      400,
      "Sessions must stay within a single calendar day.",
      {
        startDateTime,
        endDateTime
      }
    );
  }
}

function assertSessionWithinCycle(cycle: CycleRecord, startDateTime: Date, endDateTime: Date) {
  if (!cycle.startDate || !cycle.endDate) {
    throw new SessionsServiceError(
      ERROR_CODES.invalidDateRange,
      400,
      "The selected cycle is missing a valid date range."
    );
  }

  const sessionStartDate = normalizeDateOnly(startDateTime);
  const sessionEndDate = normalizeDateOnly(endDateTime);
  const cycleStartDate = normalizeDateOnly(cycle.startDate);
  const cycleEndDate = normalizeDateOnly(cycle.endDate);

  if (
    sessionStartDate.getTime() < cycleStartDate.getTime() ||
    sessionEndDate.getTime() > cycleEndDate.getTime()
  ) {
    throw new SessionsServiceError(
      ERROR_CODES.sessionOutsideCycleRange,
      409,
      "Session must stay within the selected cycle date range.",
      {
        cycleId: cycle.id,
        cycleStartDate,
        cycleEndDate,
        sessionStartDate,
        sessionEndDate
      }
    );
  }
}

function hasRelatedRecords(session: SessionRecord) {
  return (
    session._count.assignments > 0 ||
    session._count.waitingList > 0 ||
    session._count.evaluations > 0
  );
}

function assertCanDeactivateSession(session: SessionRecord) {
  if (!hasRelatedRecords(session)) {
    return;
  }

  throw new SessionsServiceError(
    ERROR_CODES.hasRelatedRecords,
    409,
    "Cannot deactivate a session while it still has related records.",
    {
      sessionId: session.id,
      assignments: session._count.assignments,
      waitingList: session._count.waitingList,
      evaluations: session._count.evaluations
    }
  );
}

function getLockedSessionProtectedFields(input: UpdateSessionInput) {
  return [
    "cycleId",
    "examType",
    "startDateTime",
    "endDateTime",
    "buildingIds",
    "isActive"
  ].filter((field) => field in input);
}

function assertLockedSessionSafety(session: SessionRecord, input: UpdateSessionInput) {
  const derivedStatus = getDerivedSessionStatus(session);

  if (
    session.status !== SessionStatus.LOCKED &&
    derivedStatus !== SessionStatus.IN_PROGRESS &&
    derivedStatus !== SessionStatus.COMPLETED
  ) {
    return;
  }

  const protectedFields = getLockedSessionProtectedFields(input);

  if (protectedFields.length === 0) {
    return;
  }

  throw new SessionsServiceError(
    ERROR_CODES.sessionLocked,
    409,
    "Protected sessions cannot change scheduling or location fields.",
    {
      sessionId: session.id,
      status: session.status,
      derivedStatus,
      protectedFields
    }
  );
}

function hasStartedSession(session: Pick<SessionRecord, "startsAt">, now = new Date()) {
  return Boolean(session.startsAt && now.getTime() >= session.startsAt.getTime());
}

function hasEndedSession(session: Pick<SessionRecord, "endsAt">, now = new Date()) {
  return Boolean(session.endsAt && now.getTime() >= session.endsAt.getTime());
}

function assertSessionStatusTransition(
  session: SessionRecord,
  nextStatus: SessionStatus,
  now = new Date()
) {
  const derivedStatus = getDerivedSessionStatus(session, now);

  if (!session.isActive) {
    throw new SessionsServiceError(
      ERROR_CODES.sessionStatusConstraintFailed,
      409,
      "Inactive sessions cannot change status.",
      {
        sessionId: session.id,
        currentStatus: session.status,
        nextStatus
      }
    );
  }

  if (session.status === nextStatus) {
    throw new SessionsServiceError(
      ERROR_CODES.invalidSessionStatusTransition,
      409,
      "Session is already in the requested status.",
      {
        sessionId: session.id,
        currentStatus: session.status,
        nextStatus
      }
    );
  }

  if (!canTransitionSessionStatus(session.status, nextStatus)) {
    throw new SessionsServiceError(
      ERROR_CODES.invalidSessionStatusTransition,
      409,
      "The requested session status transition is not allowed.",
      {
        sessionId: session.id,
        currentStatus: session.status,
        nextStatus
      }
    );
  }

  if (nextStatus === SessionStatus.IN_PROGRESS) {
    if (!session.startsAt || !session.endsAt) {
      throw new SessionsServiceError(
        ERROR_CODES.sessionStatusConstraintFailed,
        409,
        "Session timing must be defined before it can move in progress.",
        {
          sessionId: session.id,
          currentStatus: session.status,
          nextStatus
        }
      );
    }

    if (!hasStartedSession(session, now) || hasEndedSession(session, now)) {
      throw new SessionsServiceError(
        ERROR_CODES.sessionStatusConstraintFailed,
        409,
        "Session can move to in progress only during its active time window.",
        {
          sessionId: session.id,
          currentStatus: session.status,
          nextStatus,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          now
        }
      );
    }
  }

  if (
    nextStatus === SessionStatus.SCHEDULED &&
    hasStartedSession(session, now)
  ) {
    throw new SessionsServiceError(
      ERROR_CODES.sessionStatusConstraintFailed,
      409,
      "Sessions cannot be scheduled after their start time.",
      {
        sessionId: session.id,
        currentStatus: session.status,
        nextStatus,
        derivedStatus,
        startsAt: session.startsAt,
        now
      }
    );
  }

  if (
    nextStatus === SessionStatus.LOCKED &&
    hasStartedSession(session, now)
  ) {
    throw new SessionsServiceError(
      ERROR_CODES.sessionStatusConstraintFailed,
      409,
      "Sessions cannot be locked after they have started.",
      {
        sessionId: session.id,
        currentStatus: session.status,
        nextStatus,
        derivedStatus,
        startsAt: session.startsAt,
        now
      }
    );
  }

  if (nextStatus === SessionStatus.COMPLETED && !hasEndedSession(session, now)) {
    throw new SessionsServiceError(
      ERROR_CODES.sessionStatusConstraintFailed,
      409,
      "Session can complete only after its scheduled end time.",
      {
        sessionId: session.id,
        currentStatus: session.status,
        nextStatus,
        endsAt: session.endsAt,
        now
      }
    );
  }

  if (nextStatus === SessionStatus.CANCELLED) {
    if (hasStartedSession(session, now)) {
      throw new SessionsServiceError(
        ERROR_CODES.sessionCancellationNotAllowed,
        409,
        "Sessions cannot be cancelled after they have started.",
        {
          sessionId: session.id,
          currentStatus: session.status,
          nextStatus,
          derivedStatus,
          startsAt: session.startsAt,
          now
        }
      );
    }

    if (
      session.status === SessionStatus.LOCKED &&
      hasRelatedRecords(session)
    ) {
      throw new SessionsServiceError(
        ERROR_CODES.sessionCancellationNotAllowed,
        409,
        "Locked sessions can be cancelled only before they start and before related records exist.",
        {
          sessionId: session.id,
          currentStatus: session.status,
          nextStatus,
          startsAt: session.startsAt,
          now,
          assignments: session._count.assignments,
          waitingList: session._count.waitingList,
          evaluations: session._count.evaluations
        }
      );
    }

    if (
      session.status !== SessionStatus.DRAFT &&
      session.status !== SessionStatus.SCHEDULED &&
      session.status !== SessionStatus.LOCKED
    ) {
      throw new SessionsServiceError(
        ERROR_CODES.sessionCancellationNotAllowed,
        409,
        "Only draft, scheduled, or pre-start locked sessions can be cancelled.",
        {
          sessionId: session.id,
          currentStatus: session.status,
          nextStatus
        }
      );
    }
  }
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2025") {
    throw new SessionsServiceError(ERROR_CODES.sessionNotFound, 404, "Session not found.");
  }

  if (isKnownPrismaError(error) && error.code === "P2002") {
    throw new SessionsServiceError(
      ERROR_CODES.uniqueConstraintViolation,
      409,
      "The requested session change conflicts with an existing record.",
      error.meta ?? null
    );
  }

  throw error;
}

async function assertCycleExists(
  cycleId: string,
  options: IncludeInactiveOptions & { requireActive?: boolean } = {},
  client: ActivityClient = db
) {
  const cycle = await client.cycle.findUnique({
    where: {
      id: cycleId
    },
    select: cycleSummarySelect
  });

  if (!cycle || (!options.includeInactive && !cycle.isActive)) {
    throw new SessionsServiceError(ERROR_CODES.cycleNotFound, 404, "Cycle not found.");
  }

  if (options.requireActive && !cycle.isActive) {
    throw new SessionsServiceError(
      ERROR_CODES.inactiveParent,
      409,
      "Cannot attach a session to an inactive cycle.",
      {
        cycleId
      }
    );
  }

  return cycle;
}

async function assertBuildingExists(
  buildingId: string,
  options: IncludeInactiveOptions & { requireActive?: boolean } = {},
  client: ActivityClient = db
) {
  const building = await client.building.findUnique({
    where: {
      id: buildingId
    },
    select: buildingSummarySelect
  });

  if (!building || (!options.includeInactive && !building.isActive)) {
    throw new SessionsServiceError(
      ERROR_CODES.buildingNotFound,
      404,
      "Building not found."
    );
  }

  if (options.requireActive && !building.isActive) {
    throw new SessionsServiceError(
      ERROR_CODES.inactiveParent,
      409,
      "Cannot attach a session to an inactive building.",
      {
        buildingId
      }
    );
  }

  return building;
}

async function assertBuildingsExist(
  buildingIds: string[],
  options: IncludeInactiveOptions & { requireActive?: boolean } = {},
  client: ActivityClient = db
) {
  const normalizedIds = normalizeBuildingIds(buildingIds);
  const buildings = await client.building.findMany({
    where: {
      id: {
        in: normalizedIds
      }
    },
    select: buildingSummarySelect
  });

  const buildingsById = new Map(buildings.map((building) => [building.id, building]));
  const missingBuildingIds = normalizedIds.filter((buildingId) => !buildingsById.has(buildingId));

  if (missingBuildingIds.length > 0) {
    throw new SessionsServiceError(
      ERROR_CODES.buildingNotFound,
      404,
      "One or more buildings were not found.",
      {
        buildingIds: missingBuildingIds
      }
    );
  }

  if (!options.includeInactive) {
    const inactiveBuildingIds = buildings
      .filter((building) => !building.isActive)
      .map((building) => building.id);

    if (inactiveBuildingIds.length > 0) {
      throw new SessionsServiceError(
        ERROR_CODES.buildingNotFound,
        404,
        "One or more buildings were not found.",
        {
          buildingIds: inactiveBuildingIds
        }
      );
    }
  }

  if (options.requireActive) {
    const inactiveBuildings = buildings.filter((building) => !building.isActive);

    if (inactiveBuildings.length > 0) {
      throw new SessionsServiceError(
        ERROR_CODES.inactiveParent,
        409,
        "Cannot attach a session to inactive buildings.",
        {
          buildingIds: inactiveBuildings.map((building) => building.id)
        }
      );
    }
  }

  return normalizedIds.map((buildingId) => buildingsById.get(buildingId) as BuildingRecord);
}

async function assertSessionExists(sessionId: string, options: IncludeInactiveOptions = {}) {
  const session = await db.session.findUnique({
    where: {
      id: sessionId
    },
    select: sessionSelect
  });

  if (!session || (!options.includeInactive && !session.isActive)) {
    throw new SessionsServiceError(ERROR_CODES.sessionNotFound, 404, "Session not found.");
  }

  return session;
}

async function assertNoOverlappingSessions(input: {
  startDateTime: Date;
  endDateTime: Date;
  buildingIds: string[];
  excludeId?: string;
}, client: ActivityClient = db) {
  const normalizedBuildingIds = normalizeBuildingIds(input.buildingIds);
  const sessionDate = normalizeDateOnly(input.startDateTime);
  const overlappingSessions = await client.session.findMany({
    where: {
      isActive: true,
      ...(input.excludeId
        ? {
            id: {
              not: input.excludeId
            }
          }
        : {}),
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
      examType: true,
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
    throw new SessionsServiceError(
      ERROR_CODES.overlappingSession,
      409,
      "Session timing overlaps with an existing active session in the same building.",
      overlappingSessions
    );
  }
}

function createTimeRangeFilter(query: SessionListQuery) {
  if (!query.startFrom && !query.endTo) {
    return undefined;
  }

  return {
    AND: [
      ...(query.endTo
        ? [
            {
              startsAt: {
                lte: query.endTo
              }
            }
          ]
        : []),
      ...(query.startFrom
        ? [
            {
              endsAt: {
                gte: query.startFrom
              }
            }
          ]
        : [])
    ]
  } satisfies Prisma.SessionWhereInput;
}

function buildSessionData(input: {
  cycle: CycleRecord;
  name?: string;
  nameEn?: string;
  examType: SessionRecord["examType"];
  startDateTime: Date;
  endDateTime: Date;
  status: SessionStatus;
  lockedAt?: Date | null;
  notes?: string | null;
  isActive: boolean;
  currentLockedAt?: Date | null;
}) {
  const localizedName = resolveLocalizedName({
    name: input.name,
    nameEn: input.nameEn
  });

  assertValidDateRange(input.startDateTime, input.endDateTime);
  assertSessionWithinCycle(input.cycle, input.startDateTime, input.endDateTime);

  const sessionDate = normalizeDateOnly(input.startDateTime);

  return {
    cycleId: input.cycle.id,
    name: localizedName.name,
    nameEn: localizedName.nameEn ?? null,
    examType: input.examType,
    sessionDate,
    dayIndex: deriveDayIndex(input.cycle.startDate, sessionDate),
    startsAt: input.startDateTime,
    endsAt: input.endDateTime,
    status: input.status,
    lockedAt: resolveLockedAt({
      requestedLockedAt: input.lockedAt,
      status: input.status,
      currentLockedAt: input.currentLockedAt
    }),
    notes: normalizeOptionalText(input.notes) ?? null,
    isActive: input.isActive
  } satisfies Prisma.SessionUncheckedCreateInput;
}

async function syncSessionBuildings(
  client: ActivityClient,
  sessionId: string,
  buildingIds: string[],
  existingLinks: SessionRecord["buildings"]
) {
  const desiredIds = new Set(normalizeBuildingIds(buildingIds));
  const existingLinksByBuildingId = new Map(
    existingLinks.map((buildingLink) => [buildingLink.buildingId, buildingLink])
  );

  for (const existingLink of existingLinks) {
    if (!desiredIds.has(existingLink.buildingId) && existingLink.isActive) {
      await client.sessionBuilding.update({
        where: {
          id: existingLink.id
        },
        data: {
          isActive: false
        }
      });
    }
  }

  for (const buildingId of Array.from(desiredIds)) {
    const existingLink = existingLinksByBuildingId.get(buildingId);

    if (!existingLink) {
      await client.sessionBuilding.create({
        data: {
          sessionId,
          buildingId,
          isActive: true
        }
      });
      continue;
    }

    if (!existingLink.isActive) {
      await client.sessionBuilding.update({
        where: {
          id: existingLink.id
        },
        data: {
          isActive: true
        }
      });
    }
  }
}

export async function getSessions(query: SessionListQuery) {
  if (query.cycleId) {
    await assertCycleExists(query.cycleId, {
      includeInactive: query.includeInactive
    });
  }

  if (query.buildingId) {
    await assertBuildingExists(query.buildingId, {
      includeInactive: query.includeInactive
    });
  }

  const pagination = resolvePagination(query);
  const timeRangeFilter = createTimeRangeFilter(query);
  const where = {
    ...(query.cycleId
      ? {
          cycleId: query.cycleId
        }
      : {}),
    ...(query.buildingId
      ? {
          buildings: {
            some: {
              buildingId: query.buildingId,
              ...(query.includeInactive ? {} : { isActive: true })
            }
          }
        }
      : {}),
    ...(query.examType
      ? {
          examType: query.examType
        }
      : {}),
    ...(query.status
      ? {
          status: query.status
        }
      : {}),
    ...createActiveFilter(query.includeInactive),
    ...createSearchFilter(query.search),
    ...(timeRangeFilter ?? {})
  } satisfies Prisma.SessionWhereInput;
  const [data, total] = await Promise.all([
    db.session.findMany({
      where,
      orderBy: [{ startsAt: "desc" }, { name: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: sessionSelect
    }),
    db.session.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function getSessionById(
  sessionId: string,
  options: IncludeInactiveOptions = {}
) {
  return assertSessionExists(sessionId, options);
}

type SessionCreationInput = {
  cycleId: string;
  name?: string;
  nameEn?: string;
  examType: SessionRecord["examType"];
  startDateTime: Date;
  endDateTime: Date;
  buildingIds: string[];
  notes?: string | null;
  isActive?: boolean;
  status?: SessionStatus;
  lockedAt?: Date | null;
};

type SessionCreationOptions = {
  actorAppUserId?: string;
  shouldLogActivity: boolean;
};

async function createSessionWithValidation(
  client: ActivityClient,
  input: SessionCreationInput,
  options: SessionCreationOptions
) {
  const nextIsActive = input.isActive ?? true;
  const cycle = await assertCycleExists(input.cycleId, {
    requireActive: nextIsActive
  }, client);
  const buildingIds = normalizeBuildingIds(input.buildingIds);
  assertHasBuildings(buildingIds);

  await assertBuildingsExist(buildingIds, {
    requireActive: nextIsActive
  }, client);

  const sessionData = buildSessionData({
    cycle,
    name: input.name,
    nameEn: input.nameEn,
    examType: input.examType,
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    status: input.status ?? SessionStatus.DRAFT,
    lockedAt: input.lockedAt,
    notes: input.notes,
    isActive: nextIsActive
  });

  if (sessionData.isActive) {
    await assertNoOverlappingSessions({
      startDateTime: sessionData.startsAt!,
      endDateTime: sessionData.endsAt!,
      buildingIds
    }, client);
  }

  const created = await client.session.create({
    data: sessionData,
    select: sessionSelect
  });

  await syncSessionBuildings(client, created.id, buildingIds, created.buildings);

  const hydrated = await client.session.findUniqueOrThrow({
    where: {
      id: created.id
    },
    select: sessionSelect
  });

  if (options.shouldLogActivity) {
    await logActivity({
      client,
      userId: options.actorAppUserId,
      action: "create",
      entityType: "session",
      entityId: hydrated.id,
      description: `Created session ${hydrated.name}.`,
      metadata: {
        cycleId: hydrated.cycleId,
        examType: hydrated.examType,
        sessionDate: hydrated.sessionDate,
        buildingIds
      },
      afterPayload: hydrated
    });
  }

  return hydrated;
}

export async function createSessionInTransaction(
  client: Prisma.TransactionClient,
  input: SessionCreationInput
) {
  return createSessionWithValidation(
    client,
    {
      ...input,
      status: SessionStatus.DRAFT,
      lockedAt: null
    },
    {
      shouldLogActivity: false
    }
  );
}

export async function createSession(input: CreateSessionInput, actorAppUserId: string) {
  try {
    return await db.$transaction(async (tx) =>
      createSessionWithValidation(
        tx,
        {
          cycleId: input.cycleId,
          name: input.name,
          nameEn: input.nameEn,
          examType: input.examType,
          startDateTime: input.startDateTime,
          endDateTime: input.endDateTime,
          buildingIds: input.buildingIds,
          notes: input.notes,
          isActive: input.isActive ?? true,
          status: SessionStatus.DRAFT,
          lockedAt: null
        },
        {
          actorAppUserId,
          shouldLogActivity: true
        }
      )
    );
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput,
  actorAppUserId: string
) {
  const before = await getSessionById(sessionId, {
    includeInactive: true
  });
  assertLockedSessionSafety(before, input);
  const nextIsActive = input.isActive ?? before.isActive;
  const nextCycle = await assertCycleExists(input.cycleId ?? before.cycleId, {
    includeInactive: true,
    requireActive: nextIsActive
  });
  const nextBuildingIds = normalizeBuildingIds(
    input.buildingIds ??
      before.buildings
        .filter((buildingLink) => buildingLink.isActive)
        .map((buildingLink) => buildingLink.buildingId)
  );
  assertHasBuildings(nextBuildingIds);

  await assertBuildingsExist(nextBuildingIds, {
    includeInactive: true,
    requireActive: nextIsActive
  });

  const sessionData = buildSessionData({
    cycle: nextCycle,
    name: input.name ?? before.name,
    nameEn: input.nameEn ?? before.nameEn ?? undefined,
    examType: input.examType ?? before.examType,
    startDateTime: input.startDateTime ?? before.startsAt ?? new Date(NaN),
    endDateTime: input.endDateTime ?? before.endsAt ?? new Date(NaN),
    status: before.status,
    currentLockedAt: before.lockedAt,
    notes: input.notes ?? before.notes ?? undefined,
    isActive: nextIsActive
  });

  if (before.isActive && !nextIsActive) {
    assertCanDeactivateSession(before);
  }

  if (sessionData.isActive) {
    await assertNoOverlappingSessions({
      startDateTime: sessionData.startsAt!,
      endDateTime: sessionData.endsAt!,
      buildingIds: nextBuildingIds,
      excludeId: sessionId
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.session.update({
        where: {
          id: sessionId
        },
        data: sessionData,
        select: sessionSelect
      });

      await syncSessionBuildings(tx, updated.id, nextBuildingIds, updated.buildings);

      const hydrated = await tx.session.findUniqueOrThrow({
        where: {
          id: updated.id
        },
        select: sessionSelect
      });

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "update",
        entityType: "session",
        entityId: hydrated.id,
        description: `Updated session ${hydrated.name}.`,
        metadata: {
          changedFields: Object.keys(input),
          buildingIds: nextBuildingIds
        },
        beforePayload: before,
        afterPayload: hydrated
      });

      return hydrated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateSessionStatus(
  sessionId: string,
  input: UpdateSessionStatusInput,
  actorAppUserId: string
) {
  const before = await getSessionById(sessionId, {
    includeInactive: true
  });
  const nextStatus = input.status;
  assertSessionStatusTransition(before, nextStatus);

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.session.update({
        where: {
          id: sessionId
        },
        data: {
          status: nextStatus,
          lockedAt: resolveLockedAt({
            status: nextStatus,
            currentLockedAt: before.lockedAt
          })
        },
        select: sessionSelect
      });

      const hydrated = await tx.session.findUniqueOrThrow({
        where: {
          id: updated.id
        },
        select: sessionSelect
      });

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "update_status",
        entityType: "session",
        entityId: hydrated.id,
        description: `Updated session ${hydrated.name} status from ${before.status} to ${hydrated.status}.`,
        metadata: {
          previousStatus: before.status,
          nextStatus: hydrated.status,
          previousDerivedStatus: getDerivedSessionStatus(before),
          nextDerivedStatus: getDerivedSessionStatus(hydrated),
          lockedAt: hydrated.lockedAt
        },
        beforePayload: before,
        afterPayload: hydrated
      });

      return hydrated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deleteSession(sessionId: string, actorAppUserId: string) {
  const before = await getSessionById(sessionId, {
    includeInactive: true
  });

  assertCanDeactivateSession(before);

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.session.update({
        where: {
          id: sessionId
        },
        data: {
          isActive: false
        },
        select: sessionSelect
      });

      const hydrated = await tx.session.findUniqueOrThrow({
        where: {
          id: updated.id
        },
        select: sessionSelect
      });

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "delete",
        entityType: "session",
        entityId: hydrated.id,
        description: `Deactivated session ${hydrated.name}.`,
        metadata: {
          softDeleted: true,
          buildingIds: hydrated.buildings
            .filter((buildingLink) => buildingLink.isActive)
            .map((buildingLink) => buildingLink.buildingId)
        },
        beforePayload: before,
        afterPayload: hydrated
      });

      return hydrated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}
