export const sessionStatuses = [
  "DRAFT",
  "SCHEDULED",
  "LOCKED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
] as const;

export type SessionStatusValue = (typeof sessionStatuses)[number];

export const sessionLifecycleSequence: SessionStatusValue[] = [
  "DRAFT",
  "SCHEDULED",
  "LOCKED",
  "IN_PROGRESS",
  "COMPLETED"
];

const sessionStatusTransitions: Record<SessionStatusValue, SessionStatusValue[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["LOCKED", "CANCELLED"],
  LOCKED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
};

type SessionStatusTransitionSnapshot = {
  status: SessionStatusValue;
  isActive: boolean;
  startDateTime?: string | null;
  endDateTime?: string | null;
  assignmentsCount?: number;
  waitingListCount?: number;
  evaluationsCount?: number;
};

function parseDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasStartedSession(snapshot: SessionStatusTransitionSnapshot, now: Date) {
  const startsAt = parseDateTime(snapshot.startDateTime);

  if (!startsAt) {
    return false;
  }

  return now.getTime() >= startsAt.getTime();
}

function hasEndedSession(snapshot: SessionStatusTransitionSnapshot, now: Date) {
  const endsAt = parseDateTime(snapshot.endDateTime);

  if (!endsAt) {
    return false;
  }

  return now.getTime() >= endsAt.getTime();
}

function hasRelatedRecords(snapshot: SessionStatusTransitionSnapshot) {
  return (
    (snapshot.assignmentsCount ?? 0) > 0 ||
    (snapshot.waitingListCount ?? 0) > 0 ||
    (snapshot.evaluationsCount ?? 0) > 0
  );
}

export function getSessionStatusTransitions(status: SessionStatusValue) {
  return sessionStatusTransitions[status];
}

export function getAllowedSessionStatusTransitions(
  snapshot: SessionStatusTransitionSnapshot,
  now = new Date()
) {
  if (!snapshot.isActive) {
    return [] as SessionStatusValue[];
  }

  const hasStarted = hasStartedSession(snapshot, now);
  const hasEnded = hasEndedSession(snapshot, now);
  const relatedRecords = hasRelatedRecords(snapshot);

  return sessionStatusTransitions[snapshot.status].filter((nextStatus) => {
    if (nextStatus === "SCHEDULED" || nextStatus === "LOCKED") {
      return !hasStarted;
    }

    if (nextStatus === "IN_PROGRESS") {
      const startsAt = parseDateTime(snapshot.startDateTime);
      const endsAt = parseDateTime(snapshot.endDateTime);
      return Boolean(startsAt && endsAt && hasStarted && !hasEnded);
    }

    if (nextStatus === "COMPLETED") {
      return hasEnded;
    }

    if (nextStatus === "CANCELLED") {
      if (hasStarted) {
        return false;
      }

      if (snapshot.status === "LOCKED" && relatedRecords) {
        return false;
      }
    }

    return true;
  });
}
