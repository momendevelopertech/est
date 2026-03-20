export const notificationTriggerEventTypes = [
  "assignment_created",
  "assignment_swapped",
  "attendance_marked",
  "waiting_list_promoted",
  "user_block_status_changed"
] as const;

export type NotificationTriggerEventType =
  (typeof notificationTriggerEventTypes)[number];

export type AssignmentCreatedTriggerPayloadContract = {
  assignmentId: string;
};

export type AssignmentSwappedTriggerPayloadContract = {
  sessionId: string;
  changedAssignmentIds: string[];
  swapKind:
    | "DIRECT_ASSIGNMENT_SWAP"
    | "WAITING_LIST_REPLACEMENT"
    | "MANUAL_REPLACEMENT";
};

export type AttendanceMarkedTriggerPayloadContract = {
  assignmentId: string;
  attendanceStatus: "CONFIRMED" | "ABSENT" | "DECLINED";
};

export type WaitingListPromotedTriggerPayloadContract = {
  waitingListId: string;
  assignmentId: string;
};

export type UserBlockStatusChangedTriggerPayloadContract = {
  userId: string;
  mode: "blocked" | "unblocked";
  blockId?: string | null;
};

export type NotificationTriggerInputContract =
  | {
      eventType: "assignment_created";
      payload: AssignmentCreatedTriggerPayloadContract;
    }
  | {
      eventType: "assignment_swapped";
      payload: AssignmentSwappedTriggerPayloadContract;
    }
  | {
      eventType: "attendance_marked";
      payload: AttendanceMarkedTriggerPayloadContract;
    }
  | {
      eventType: "waiting_list_promoted";
      payload: WaitingListPromotedTriggerPayloadContract;
    }
  | {
      eventType: "user_block_status_changed";
      payload: UserBlockStatusChangedTriggerPayloadContract;
    };

export type PreparedEmailNotificationRecipientContract = {
  userId: string;
  email: string;
  locale: "en" | "ar";
  templateId: string;
  templateKey: string;
  templateType: string;
  subject: string;
  body: string;
  variables: Record<string, string | number | boolean | null>;
  missingVariables: string[];
  unexpectedVariables: string[];
};

export type SkippedNotificationRecipientContract = {
  userId: string | null;
  reason:
    | "user_not_found"
    | "user_inactive"
    | "user_blocked"
    | "user_email_missing"
    | "template_missing"
    | "invalid_email"
    | "payload_invalid";
  details?: Record<string, unknown>;
};

export type NotificationTriggerExecutionResultContract = {
  eventType: NotificationTriggerEventType;
  sourceEntityType: string;
  sourceEntityId: string;
  templateKey: string | null;
  status: "prepared" | "no_targets" | "template_missing" | "error";
  targetUsersCount: number;
  preparedCount: number;
  skippedCount: number;
  preparedNotifications: PreparedEmailNotificationRecipientContract[];
  skippedRecipients: SkippedNotificationRecipientContract[];
  error: string | null;
  triggeredAt: Date;
};
