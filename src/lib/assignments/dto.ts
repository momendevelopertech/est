import { SessionStatus } from "@prisma/client";

import { serializeForApi } from "@/lib/dto/serialize";
import { getDerivedSessionStatus } from "@/lib/sessions/status";

type AssignmentLike = {
  session?: {
    endsAt?: Date | null;
    startsAt?: Date | null;
    status: SessionStatus;
  } | null;
} & Record<string, unknown>;

export function toAssignmentDTO<T extends AssignmentLike>(assignment: T) {
  const session = assignment.session
    ? {
        ...assignment.session,
        derivedStatus: getDerivedSessionStatus(assignment.session)
      }
    : null;

  return serializeForApi({
    ...assignment,
    session
  });
}
