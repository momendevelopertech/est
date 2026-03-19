import { SessionStatus } from "@prisma/client";

type SessionStatusSnapshot = {
  endsAt?: Date | null;
  startsAt?: Date | null;
  status: SessionStatus;
};

export const SESSION_STATUS_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  [SessionStatus.DRAFT]: [SessionStatus.SCHEDULED, SessionStatus.CANCELLED],
  [SessionStatus.SCHEDULED]: [SessionStatus.LOCKED, SessionStatus.CANCELLED],
  [SessionStatus.LOCKED]: [SessionStatus.IN_PROGRESS, SessionStatus.CANCELLED],
  [SessionStatus.IN_PROGRESS]: [SessionStatus.COMPLETED],
  [SessionStatus.COMPLETED]: [],
  [SessionStatus.CANCELLED]: []
};

export function canTransitionSessionStatus(
  currentStatus: SessionStatus,
  nextStatus: SessionStatus
) {
  return SESSION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function getDerivedSessionStatus(
  session: SessionStatusSnapshot,
  now = new Date()
) {
  if (
    session.status === SessionStatus.DRAFT ||
    session.status === SessionStatus.CANCELLED ||
    session.status === SessionStatus.COMPLETED
  ) {
    return session.status;
  }

  if (!session.startsAt || !session.endsAt) {
    return session.status;
  }

  if (now.getTime() >= session.endsAt.getTime()) {
    return SessionStatus.COMPLETED;
  }

  if (now.getTime() >= session.startsAt.getTime()) {
    return SessionStatus.IN_PROGRESS;
  }

  return session.status;
}
