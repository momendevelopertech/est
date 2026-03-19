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

export function getSessionStatusTransitions(status: SessionStatusValue) {
  return sessionStatusTransitions[status];
}
