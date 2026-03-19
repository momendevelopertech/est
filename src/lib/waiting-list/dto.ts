import { SessionStatus } from "@prisma/client";

import { serializeForApi } from "@/lib/dto/serialize";
import { getDerivedSessionStatus } from "@/lib/sessions/status";

type WaitingListSessionLike = {
  endsAt?: Date | null;
  startsAt?: Date | null;
  status: SessionStatus;
} | null;

type WaitingListLike = {
  session?: WaitingListSessionLike;
} & Record<string, unknown>;

export function toWaitingListDTO<T extends WaitingListLike>(entry: T) {
  const session = entry.session
    ? {
        ...entry.session,
        derivedStatus: getDerivedSessionStatus(entry.session)
      }
    : null;

  return serializeForApi({
    ...entry,
    session
  });
}

