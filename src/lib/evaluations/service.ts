import {
  AssignmentStatus,
  Prisma,
  SessionStatus,
  type PrismaClient
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";
import { createBilingualSearchFilter } from "@/lib/search/bilingual";
import { getDerivedSessionStatus } from "@/lib/sessions/status";

import type {
  CreateEvaluationContract,
  EvaluationListContract,
  EvaluationMutationMode
} from "./contracts";
import type { CreateEvaluationInput, EvaluationListQuery } from "./validation";

type ActivityClient = Prisma.TransactionClient | PrismaClient;

const evaluationSessionSelect = {
  id: true,
  cycleId: true,
  name: true,
  nameEn: true,
  examType: true,
  status: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  cycle: {
    select: {
      id: true,
      isActive: true
    }
  }
} satisfies Prisma.SessionSelect;

const evaluationAssignmentSelect = {
  id: true,
  sessionId: true,
  userId: true,
  buildingId: true,
  floorId: true,
  roomId: true,
  roleDefinitionId: true,
  status: true,
  assignedMethod: true,
  session: {
    select: evaluationSessionSelect
  },
  user: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      phone: true,
      averageRating: true,
      isActive: true
    }
  },
  building: {
    select: {
      id: true,
      name: true,
      nameEn: true
    }
  },
  floor: {
    select: {
      id: true,
      name: true,
      nameEn: true
    }
  },
  room: {
    select: {
      id: true,
      name: true,
      nameEn: true
    }
  },
  roleDefinition: {
    select: {
      id: true,
      key: true,
      name: true,
      nameEn: true,
      scope: true
    }
  }
} satisfies Prisma.AssignmentSelect;

const evaluationSelect = {
  id: true,
  sessionId: true,
  subjectUserId: true,
  evaluatorAppUserId: true,
  score: true,
  notes: true,
  criteriaPayload: true,
  createdAt: true,
  updatedAt: true,
  session: {
    select: evaluationSessionSelect
  },
  subjectUser: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      phone: true,
      averageRating: true,
      isActive: true
    }
  },
  evaluatorAppUser: {
    select: {
      id: true,
      displayName: true,
      role: true
    }
  }
} satisfies Prisma.EvaluationSelect;

type SessionRecord = Prisma.SessionGetPayload<{
  select: typeof evaluationSessionSelect;
}>;

type AssignmentRecord = Prisma.AssignmentGetPayload<{
  select: typeof evaluationAssignmentSelect;
}>;

type EvaluationRecord = Prisma.EvaluationGetPayload<{
  select: typeof evaluationSelect;
}>;

type HydratedEvaluationRecord = EvaluationRecord & {
  assignmentId: string | null;
  assignment: AssignmentRecord | null;
};

export class EvaluationServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "EvaluationServiceError";
  }
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function createSearchFilter(search?: string) {
  const normalized = search?.trim();
  const subjectUserFilter = createBilingualSearchFilter(normalized, ["phone"]);
  const sessionFilter = createBilingualSearchFilter(normalized);
  const filters: Prisma.EvaluationWhereInput[] = [];

  if (subjectUserFilter) {
    filters.push({
      subjectUser: subjectUserFilter
    });
  }

  if (sessionFilter) {
    filters.push({
      session: sessionFilter
    });
  }

  if (normalized) {
    filters.push({
      evaluatorAppUser: {
        OR: [
          {
            displayName: {
              contains: normalized,
              mode: "insensitive"
            }
          },
          {
            email: {
              contains: normalized,
              mode: "insensitive"
            }
          }
        ]
      }
    });
  }

  if (filters.length === 0) {
    return undefined;
  }

  return {
    OR: filters
  } satisfies Prisma.EvaluationWhereInput;
}

function assertSessionEvaluationOperational(session: SessionRecord, now = new Date()) {
  const derivedStatus = getDerivedSessionStatus(session, now);
  const statusAllowsEvaluation =
    session.status === SessionStatus.IN_PROGRESS ||
    session.status === SessionStatus.COMPLETED ||
    derivedStatus === SessionStatus.IN_PROGRESS ||
    derivedStatus === SessionStatus.COMPLETED;

  if (!session.isActive || !session.cycle.isActive) {
    throw new EvaluationServiceError(
      ERROR_CODES.evaluationSessionNotOperational,
      409,
      "Evaluations require an active session in an active cycle.",
      {
        sessionId: session.id,
        cycleId: session.cycleId,
        isSessionActive: session.isActive,
        isCycleActive: session.cycle.isActive
      }
    );
  }

  if (
    session.status === SessionStatus.CANCELLED ||
    derivedStatus === SessionStatus.CANCELLED
  ) {
    throw new EvaluationServiceError(
      ERROR_CODES.evaluationSessionNotOperational,
      409,
      "Evaluations are not allowed for cancelled sessions.",
      {
        sessionId: session.id,
        status: session.status,
        derivedStatus
      }
    );
  }

  if (!statusAllowsEvaluation) {
    throw new EvaluationServiceError(
      ERROR_CODES.evaluationSessionNotOperational,
      409,
      "Evaluations are allowed only after the session starts.",
      {
        sessionId: session.id,
        status: session.status,
        derivedStatus
      }
    );
  }
}

function assertAssignmentEvaluable(assignment: AssignmentRecord) {
  if (assignment.status !== AssignmentStatus.CANCELLED) {
    return;
  }

  throw new EvaluationServiceError(
    ERROR_CODES.evaluationAssignmentNotOperational,
    409,
    "Cancelled assignments cannot be evaluated.",
    {
      assignmentId: assignment.id,
      assignmentStatus: assignment.status
    }
  );
}

async function assertAssignmentExists(client: ActivityClient, assignmentId: string) {
  const assignment = await client.assignment.findUnique({
    where: {
      id: assignmentId
    },
    select: evaluationAssignmentSelect
  });

  if (!assignment) {
    throw new EvaluationServiceError(
      ERROR_CODES.assignmentNotFound,
      404,
      "Assignment not found."
    );
  }

  return assignment;
}

function assertAssignmentLink(
  input: Pick<CreateEvaluationContract, "sessionId" | "userId" | "assignmentId">,
  assignment: AssignmentRecord
) {
  if (input.sessionId !== assignment.sessionId) {
    throw new EvaluationServiceError(
      ERROR_CODES.evaluationSessionMismatch,
      409,
      "Assignment does not belong to the provided session.",
      {
        assignmentId: assignment.id,
        assignmentSessionId: assignment.sessionId,
        sessionId: input.sessionId
      }
    );
  }

  if (input.userId !== assignment.userId) {
    throw new EvaluationServiceError(
      ERROR_CODES.evaluationAssignmentUserMismatch,
      409,
      "Assignment does not belong to the provided user.",
      {
        assignmentId: assignment.id,
        assignmentUserId: assignment.userId,
        userId: input.userId
      }
    );
  }
}

function createSessionUserKey(sessionId: string, userId: string) {
  return `${sessionId}:${userId}`;
}

async function hydrateEvaluationsWithAssignments(
  client: ActivityClient,
  evaluations: EvaluationRecord[]
): Promise<HydratedEvaluationRecord[]> {
  if (evaluations.length === 0) {
    return [];
  }

  const uniquePairs = new Map<
    string,
    {
      sessionId: string;
      userId: string;
    }
  >();

  for (const evaluation of evaluations) {
    uniquePairs.set(
      createSessionUserKey(evaluation.sessionId, evaluation.subjectUserId),
      {
        sessionId: evaluation.sessionId,
        userId: evaluation.subjectUserId
      }
    );
  }

  const assignmentPairs = Array.from(uniquePairs.values());
  const assignments = await client.assignment.findMany({
    where: {
      OR: assignmentPairs.map((pair) => ({
        sessionId: pair.sessionId,
        userId: pair.userId
      }))
    },
    select: evaluationAssignmentSelect
  });
  const assignmentByKey = new Map(
    assignments.map((assignment) => [
      createSessionUserKey(assignment.sessionId, assignment.userId),
      assignment
    ])
  );

  return evaluations.map((evaluation) => {
    const assignment =
      assignmentByKey.get(
        createSessionUserKey(evaluation.sessionId, evaluation.subjectUserId)
      ) ?? null;

    return {
      ...evaluation,
      assignmentId: assignment?.id ?? null,
      assignment
    };
  });
}

async function assertNoSelfEvaluation(
  client: Prisma.TransactionClient,
  actorAppUserId: string,
  subjectUserId: string
) {
  const actor = await client.appUser.findUnique({
    where: {
      id: actorAppUserId
    },
    select: {
      id: true,
      isActive: true,
      linkedUserId: true
    }
  });

  if (!actor || !actor.isActive) {
    throw new EvaluationServiceError(
      ERROR_CODES.unauthorized,
      401,
      "Evaluator account is not active."
    );
  }

  if (actor.linkedUserId && actor.linkedUserId === subjectUserId) {
    throw new EvaluationServiceError(
      ERROR_CODES.evaluationSelfNotAllowed,
      409,
      "Self-evaluation is not allowed.",
      {
        actorAppUserId,
        subjectUserId
      }
    );
  }
}

async function recalculateSubjectAverageRating(
  client: Prisma.TransactionClient,
  subjectUserId: string
) {
  const aggregate = await client.evaluation.aggregate({
    where: {
      subjectUserId
    },
    _avg: {
      score: true
    }
  });
  const nextAverageRating = aggregate._avg.score ?? new Prisma.Decimal(0);

  await client.user.update({
    where: {
      id: subjectUserId
    },
    data: {
      averageRating: nextAverageRating
    }
  });

  return nextAverageRating;
}

function normalizeMutationError(error: unknown): never {
  if (error instanceof EvaluationServiceError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new EvaluationServiceError(
      ERROR_CODES.duplicateEvaluation,
      409,
      "Evaluation already exists for this assignment.",
      error.meta ?? null
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new EvaluationServiceError(
      ERROR_CODES.evaluationNotFound,
      404,
      "Evaluation record was not found."
    );
  }

  throw error;
}

export async function getEvaluations(query: EvaluationListQuery) {
  const contractQuery: EvaluationListContract = query;
  const pagination = resolvePagination(contractQuery);
  const assignmentScopedFilter =
    contractQuery.assignmentId !== undefined
      ? await (async () => {
          const assignment = await db.assignment.findUnique({
            where: {
              id: contractQuery.assignmentId
            },
            select: {
              sessionId: true,
              userId: true
            }
          });

          if (!assignment) {
            throw new EvaluationServiceError(
              ERROR_CODES.assignmentNotFound,
              404,
              "Assignment not found."
            );
          }

          return {
            sessionId: assignment.sessionId,
            subjectUserId: assignment.userId
          } satisfies Prisma.EvaluationWhereInput;
        })()
      : {};
  const where = {
    ...assignmentScopedFilter,
    ...(contractQuery.sessionId
      ? {
          sessionId: contractQuery.sessionId
        }
      : {}),
    ...(contractQuery.userId
      ? {
          subjectUserId: contractQuery.userId
        }
      : {}),
    ...(contractQuery.evaluatorAppUserId
      ? {
          evaluatorAppUserId: contractQuery.evaluatorAppUserId
        }
      : {}),
    ...createSearchFilter(contractQuery.search)
  } satisfies Prisma.EvaluationWhereInput;

  const [data, total] = await Promise.all([
    db.evaluation.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: evaluationSelect
    }),
    db.evaluation.count({
      where
    })
  ]);
  const hydratedData = await hydrateEvaluationsWithAssignments(db, data);

  return {
    data: hydratedData,
    pagination: buildPaginationMeta(total, pagination)
  };
}

export async function createEvaluation(
  input: CreateEvaluationInput,
  actorAppUserId: string
) {
  const contractInput: CreateEvaluationContract = {
    sessionId: input.sessionId,
    assignmentId: input.assignmentId,
    userId: input.userId,
    rating: input.rating,
    notes: input.notes,
    allowUpdate: input.allowUpdate
  };

  try {
    return await db.$transaction(
      async (tx) => {
        const assignment = await assertAssignmentExists(tx, contractInput.assignmentId);

        assertAssignmentLink(contractInput, assignment);
        assertAssignmentEvaluable(assignment);
        assertSessionEvaluationOperational(assignment.session);
        await assertNoSelfEvaluation(tx, actorAppUserId, assignment.userId);

        const existing = await tx.evaluation.findFirst({
          where: {
            sessionId: assignment.sessionId,
            subjectUserId: assignment.userId
          },
          select: evaluationSelect
        });
        const score = new Prisma.Decimal(contractInput.rating);
        const notes = normalizeOptionalText(contractInput.notes) ?? null;
        let mode: EvaluationMutationMode = "created";
        let evaluation: EvaluationRecord;
        const previousAverageRating = assignment.user.averageRating;

        if (existing) {
          if (!contractInput.allowUpdate) {
            throw new EvaluationServiceError(
              ERROR_CODES.duplicateEvaluation,
              409,
              "An evaluation already exists for this assignment.",
              {
                assignmentId: assignment.id,
                evaluationId: existing.id,
                evaluatorAppUserId: existing.evaluatorAppUserId
              }
            );
          }

          if (existing.evaluatorAppUserId !== actorAppUserId) {
            throw new EvaluationServiceError(
              ERROR_CODES.evaluationUpdateNotAllowed,
              403,
              "Only the original evaluator can update this evaluation.",
              {
                assignmentId: assignment.id,
                evaluationId: existing.id,
                evaluatorAppUserId: existing.evaluatorAppUserId,
                actorAppUserId
              }
            );
          }

          evaluation = await tx.evaluation.update({
            where: {
              id: existing.id
            },
            data: {
              score,
              notes
            },
            select: evaluationSelect
          });
          mode = "updated";

          const nextAverageRating = await recalculateSubjectAverageRating(
            tx,
            assignment.userId
          );

          await logActivity({
            client: tx,
            userId: actorAppUserId,
            action: "evaluation_update",
            entityType: "evaluation",
            entityId: evaluation.id,
            description: `Updated evaluation for assignment ${assignment.id}.`,
            metadata: {
              sessionId: assignment.sessionId,
              assignmentId: assignment.id,
              subjectUserId: assignment.userId,
              evaluatorAppUserId: actorAppUserId,
              previousRating: existing.score.toString(),
              nextRating: evaluation.score.toString(),
              previousAverageRating: previousAverageRating.toString(),
              nextAverageRating: nextAverageRating.toString()
            },
            beforePayload: existing,
            afterPayload: evaluation
          });

          const hydrated = {
            ...evaluation,
            assignmentId: assignment.id,
            assignment
          } satisfies HydratedEvaluationRecord;

          return {
            mode,
            data: hydrated
          };
        }

        evaluation = await tx.evaluation.create({
          data: {
            sessionId: assignment.sessionId,
            subjectUserId: assignment.userId,
            evaluatorAppUserId: actorAppUserId,
            score,
            notes
          },
          select: evaluationSelect
        });

        const nextAverageRating = await recalculateSubjectAverageRating(
          tx,
          assignment.userId
        );

        await logActivity({
          client: tx,
          userId: actorAppUserId,
          action: "evaluation_create",
          entityType: "evaluation",
          entityId: evaluation.id,
          description: `Created evaluation for assignment ${assignment.id}.`,
          metadata: {
            sessionId: assignment.sessionId,
            assignmentId: assignment.id,
            subjectUserId: assignment.userId,
            evaluatorAppUserId: actorAppUserId,
            rating: evaluation.score.toString(),
            previousAverageRating: previousAverageRating.toString(),
            nextAverageRating: nextAverageRating.toString()
          },
          afterPayload: evaluation
        });

        const hydrated = {
          ...evaluation,
          assignmentId: assignment.id,
          assignment
        } satisfies HydratedEvaluationRecord;

        return {
          mode,
          data: hydrated
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch (error) {
    normalizeMutationError(error);
  }
}
