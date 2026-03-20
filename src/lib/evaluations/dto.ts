import { SessionStatus } from "@prisma/client";

import { serializeForApi } from "@/lib/dto/serialize";
import { getDerivedSessionStatus } from "@/lib/sessions/status";

type EvaluationLike = {
  score?: unknown;
  session?: {
    endsAt?: Date | null;
    startsAt?: Date | null;
    status: SessionStatus;
  } | null;
} & Record<string, unknown>;

export function toEvaluationDTO<T extends EvaluationLike>(evaluation: T) {
  const session = evaluation.session
    ? {
        ...evaluation.session,
        derivedStatus: getDerivedSessionStatus(evaluation.session)
      }
    : null;
  const { score, ...rest } = evaluation;

  return serializeForApi({
    ...rest,
    rating: score,
    session
  });
}
