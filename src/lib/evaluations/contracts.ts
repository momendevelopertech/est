import type { SessionStatus } from "@prisma/client";

export const evaluationRatingRange = {
  min: 1,
  max: 5
} as const;

export type EvaluationListContract = {
  page?: number;
  pageSize?: number;
  search?: string;
  sessionId?: string;
  assignmentId?: string;
  userId?: string;
  evaluatorAppUserId?: string;
};

export type CreateEvaluationContract = {
  sessionId: string;
  assignmentId: string;
  userId: string;
  rating: number;
  notes?: string;
  allowUpdate?: boolean;
};

export type EvaluationMutationMode = "created" | "updated";

export type EvaluationSessionContextContract = {
  sessionId: string;
  cycleId: string;
  status: SessionStatus;
  derivedStatus: SessionStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
};
