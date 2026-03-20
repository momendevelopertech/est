import { randomUUID } from "node:crypto";

import {
  BlockStatus,
  LocaleCode,
  Prisma,
  type PrismaClient
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { isUserBlockedState } from "@/lib/blocks/state";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { reportNotificationFailure } from "@/lib/monitoring/service";
import {
  NotificationEmailTemplatesServiceError,
  renderNotificationEmailTemplate
} from "@/lib/notifications/email/service";
import { createNotification } from "@/lib/notifications/in-app/service";
import { getUserPreferences } from "@/lib/notifications/preferences/service";
import {
  getSmsDeliverySettings,
  isValidSmsPhoneNumber,
  sendSms
} from "@/lib/notifications/sms/service";
import {
  getWhatsAppDeliverySettings,
  sendWhatsAppMessage
} from "@/lib/notifications/whatsapp/service";

import type {
  NotificationTriggerExecutionResultContract,
  NotificationTriggerInputContract,
  PreparedEmailNotificationRecipientContract,
  SkippedNotificationRecipientContract
} from "./contracts";
import { executeNotificationTriggerSchema } from "./validation";

type QueryClient = Prisma.TransactionClient | PrismaClient;

type TriggerUserRecord = {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  nameEn: string | null;
  preferredLanguage: LocaleCode | null;
  isActive: boolean;
  blockStatus: BlockStatus;
  blockEndsAt: Date | null;
};

type TriggerTarget = {
  user: TriggerUserRecord;
  variablesEn: Record<string, string | number | boolean | null>;
  variablesAr: Record<string, string | number | boolean | null>;
};

type ResolvedTriggerExecution = {
  sourceEntityType: string;
  sourceEntityId: string;
  templateKey: string;
  requireUnblocked: boolean;
  targets: TriggerTarget[];
};

const attendanceStateByStatus = {
  CONFIRMED: {
    en: "PRESENT",
    ar: "حاضر"
  },
  ABSENT: {
    en: "ABSENT",
    ar: "غائب"
  },
  DECLINED: {
    en: "DECLINED",
    ar: "معتذر"
  }
} as const;

const triggerTemplateKeys = {
  assignmentCreated: "assignment_created",
  assignmentSwapped: "assignment_swapped",
  attendanceMarked: "attendance_marked",
  waitingListPromoted: "waiting_list_promoted",
  userBlocked: "user_blocked",
  userUnblocked: "user_unblocked"
} as const;

const emailEnabledSettingKeys = [
  "email_enabled",
  "notifications.email_enabled"
] as const;

const userNotificationSelect = {
  id: true,
  phone: true,
  email: true,
  name: true,
  nameEn: true,
  preferredLanguage: true,
  isActive: true,
  blockStatus: true,
  blockEndsAt: true
} satisfies Prisma.UserSelect;

const assignmentNotificationSelect = {
  id: true,
  status: true,
  assignedMethod: true,
  sessionId: true,
  user: {
    select: userNotificationSelect
  },
  session: {
    select: {
      id: true,
      examType: true,
      sessionDate: true,
      name: true,
      nameEn: true
    }
  },
  building: {
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
      nameEn: true
    }
  }
} satisfies Prisma.AssignmentSelect;

type AssignmentNotificationRecord = Prisma.AssignmentGetPayload<{
  select: typeof assignmentNotificationSelect;
}>;

export class NotificationTriggerServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "NotificationTriggerServiceError";
  }
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function resolveLocale(preferredLanguage: LocaleCode | null): "en" | "ar" {
  return preferredLanguage === LocaleCode.AR ? "ar" : "en";
}

function resolveLocalizedValue(
  locale: "en" | "ar",
  arabic: string,
  english: string | null | undefined
) {
  if (locale === "ar") {
    return arabic;
  }

  return english?.trim() ? english : arabic;
}

function normalizeEmail(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseBooleanSettingValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on" ||
      normalized === "enabled"
    ) {
      return true;
    }

    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no" ||
      normalized === "off" ||
      normalized === "disabled"
    ) {
      return false;
    }
  }

  return fallback;
}

async function getEmailChannelEnabledSetting(client: QueryClient) {
  const records = await client.setting.findMany({
    where: {
      key: {
        in: [...emailEnabledSettingKeys]
      },
      isActive: true
    },
    select: {
      key: true,
      value: true
    }
  });
  const recordByKey = new Map(records.map((record) => [record.key, record.value]));

  for (const key of emailEnabledSettingKeys) {
    if (recordByKey.has(key)) {
      return parseBooleanSettingValue(recordByKey.get(key), true);
    }
  }

  return true;
}

function buildAssignmentTarget(record: AssignmentNotificationRecord): TriggerTarget {
  return {
    user: record.user,
    variablesEn: {
      name: resolveLocalizedValue("en", record.user.name, record.user.nameEn),
      session: resolveLocalizedValue("en", record.session.name, record.session.nameEn),
      building: resolveLocalizedValue("en", record.building.name, record.building.nameEn),
      role: resolveLocalizedValue(
        "en",
        record.roleDefinition.name,
        record.roleDefinition.nameEn
      ),
      examType: record.session.examType,
      sessionDate: formatDate(record.session.sessionDate),
      assignmentId: record.id,
      assignmentStatus: record.status,
      assignedMethod: record.assignedMethod
    },
    variablesAr: {
      name: resolveLocalizedValue("ar", record.user.name, record.user.nameEn),
      session: resolveLocalizedValue("ar", record.session.name, record.session.nameEn),
      building: resolveLocalizedValue("ar", record.building.name, record.building.nameEn),
      role: resolveLocalizedValue(
        "ar",
        record.roleDefinition.name,
        record.roleDefinition.nameEn
      ),
      examType: record.session.examType,
      sessionDate: formatDate(record.session.sessionDate),
      assignmentId: record.id,
      assignmentStatus: record.status,
      assignedMethod: record.assignedMethod
    }
  };
}

async function resolveAssignmentCreatedTrigger(
  client: QueryClient,
  payload: NotificationTriggerInputContract["payload"] & { assignmentId: string }
): Promise<ResolvedTriggerExecution> {
  const assignment = await client.assignment.findUnique({
    where: {
      id: payload.assignmentId
    },
    select: assignmentNotificationSelect
  });

  if (!assignment) {
    throw new NotificationTriggerServiceError(
      ERROR_CODES.assignmentNotFound,
      404,
      "Assignment not found for notification trigger.",
      {
        assignmentId: payload.assignmentId
      }
    );
  }

  return {
    sourceEntityType: "assignment",
    sourceEntityId: assignment.id,
    templateKey: triggerTemplateKeys.assignmentCreated,
    requireUnblocked: true,
    targets: [buildAssignmentTarget(assignment)]
  };
}

async function resolveAssignmentSwappedTrigger(
  client: QueryClient,
  payload: NotificationTriggerInputContract["payload"] & {
    sessionId: string;
    changedAssignmentIds: string[];
    swapKind:
      | "DIRECT_ASSIGNMENT_SWAP"
      | "WAITING_LIST_REPLACEMENT"
      | "MANUAL_REPLACEMENT";
  }
): Promise<ResolvedTriggerExecution> {
  const assignments = await client.assignment.findMany({
    where: {
      id: {
        in: payload.changedAssignmentIds
      }
    },
    select: assignmentNotificationSelect
  });

  if (assignments.length === 0) {
    throw new NotificationTriggerServiceError(
      ERROR_CODES.assignmentNotFound,
      404,
      "Swap notification trigger could not resolve changed assignments.",
      {
        changedAssignmentIds: payload.changedAssignmentIds
      }
    );
  }

  return {
    sourceEntityType: "swap",
    sourceEntityId: payload.sessionId,
    templateKey: triggerTemplateKeys.assignmentSwapped,
    requireUnblocked: true,
    targets: assignments.map((assignment) => {
      const baseTarget = buildAssignmentTarget(assignment);

      return {
        ...baseTarget,
        variablesEn: {
          ...baseTarget.variablesEn,
          swapKind: payload.swapKind
        },
        variablesAr: {
          ...baseTarget.variablesAr,
          swapKind: payload.swapKind
        }
      };
    })
  };
}

async function resolveAttendanceMarkedTrigger(
  client: QueryClient,
  payload: NotificationTriggerInputContract["payload"] & {
    assignmentId: string;
    attendanceStatus: "CONFIRMED" | "ABSENT" | "DECLINED";
  }
): Promise<ResolvedTriggerExecution> {
  const assignment = await client.assignment.findUnique({
    where: {
      id: payload.assignmentId
    },
    select: assignmentNotificationSelect
  });

  if (!assignment) {
    throw new NotificationTriggerServiceError(
      ERROR_CODES.assignmentNotFound,
      404,
      "Attendance notification trigger could not resolve assignment.",
      {
        assignmentId: payload.assignmentId
      }
    );
  }

  const stateLabels = attendanceStateByStatus[payload.attendanceStatus];
  const baseTarget = buildAssignmentTarget(assignment);

  return {
    sourceEntityType: "attendance",
    sourceEntityId: assignment.id,
    templateKey: triggerTemplateKeys.attendanceMarked,
    requireUnblocked: true,
    targets: [
      {
        ...baseTarget,
        variablesEn: {
          ...baseTarget.variablesEn,
          attendanceStatus: payload.attendanceStatus,
          attendanceState: stateLabels.en
        },
        variablesAr: {
          ...baseTarget.variablesAr,
          attendanceStatus: payload.attendanceStatus,
          attendanceState: stateLabels.ar
        }
      }
    ]
  };
}

async function resolveWaitingListPromotedTrigger(
  client: QueryClient,
  payload: NotificationTriggerInputContract["payload"] & {
    waitingListId: string;
    assignmentId: string;
  }
): Promise<ResolvedTriggerExecution> {
  const [waitingListEntry, assignment] = await Promise.all([
    client.waitingList.findUnique({
      where: {
        id: payload.waitingListId
      },
      select: {
        id: true
      }
    }),
    client.assignment.findUnique({
      where: {
        id: payload.assignmentId
      },
      select: assignmentNotificationSelect
    })
  ]);

  if (!waitingListEntry || !assignment) {
    throw new NotificationTriggerServiceError(
      ERROR_CODES.waitingListEntryNotFound,
      404,
      "Waiting-list promotion trigger could not resolve promotion records.",
      {
        waitingListId: payload.waitingListId,
        assignmentId: payload.assignmentId
      }
    );
  }

  const target = buildAssignmentTarget(assignment);

  return {
    sourceEntityType: "waiting_list",
    sourceEntityId: waitingListEntry.id,
    templateKey: triggerTemplateKeys.waitingListPromoted,
    requireUnblocked: true,
    targets: [
      {
        ...target,
        variablesEn: {
          ...target.variablesEn,
          waitingListId: waitingListEntry.id
        },
        variablesAr: {
          ...target.variablesAr,
          waitingListId: waitingListEntry.id
        }
      }
    ]
  };
}

async function resolveUserBlockStatusChangedTrigger(
  client: QueryClient,
  payload: NotificationTriggerInputContract["payload"] & {
    userId: string;
    mode: "blocked" | "unblocked";
    blockId?: string | null;
  }
): Promise<ResolvedTriggerExecution> {
  const user = await client.user.findUnique({
    where: {
      id: payload.userId
    },
    select: userNotificationSelect
  });

  if (!user) {
    throw new NotificationTriggerServiceError(
      ERROR_CODES.userNotFound,
      404,
      "User not found for block notification trigger.",
      {
        userId: payload.userId
      }
    );
  }

  return {
    sourceEntityType: "block",
    sourceEntityId: payload.blockId ?? user.id,
    templateKey:
      payload.mode === "blocked"
        ? triggerTemplateKeys.userBlocked
        : triggerTemplateKeys.userUnblocked,
    requireUnblocked: false,
    targets: [
      {
        user,
        variablesEn: {
          name: resolveLocalizedValue("en", user.name, user.nameEn),
          blockAction: payload.mode,
          blockStatus: user.blockStatus,
          blockEndsAt: user.blockEndsAt?.toISOString() ?? null
        },
        variablesAr: {
          name: resolveLocalizedValue("ar", user.name, user.nameEn),
          blockAction: payload.mode,
          blockStatus: user.blockStatus,
          blockEndsAt: user.blockEndsAt?.toISOString() ?? null
        }
      }
    ]
  };
}

async function resolveTriggerExecution(
  client: QueryClient,
  input: NotificationTriggerInputContract
): Promise<ResolvedTriggerExecution> {
  switch (input.eventType) {
    case "assignment_created":
      return resolveAssignmentCreatedTrigger(client, input.payload);
    case "assignment_swapped":
      return resolveAssignmentSwappedTrigger(client, input.payload);
    case "attendance_marked":
      return resolveAttendanceMarkedTrigger(client, input.payload);
    case "waiting_list_promoted":
      return resolveWaitingListPromotedTrigger(client, input.payload);
    case "user_block_status_changed":
      return resolveUserBlockStatusChangedTrigger(client, input.payload);
    default:
      throw new NotificationTriggerServiceError(
        ERROR_CODES.validationError,
        400,
        "Unsupported notification trigger event type."
      );
  }
}

function evaluateRecipientEligibility(
  target: TriggerTarget,
  options: {
    requireUnblocked: boolean;
  }
):
  | {
      eligible: true;
    }
  | {
      eligible: false;
      reason: "user_inactive" | "user_blocked";
    } {
  if (!target.user.isActive) {
    return {
      eligible: false,
      reason: "user_inactive" as const
    };
  }

  if (
    options.requireUnblocked &&
    isUserBlockedState({
      blockStatus: target.user.blockStatus,
      blockEndsAt: target.user.blockEndsAt
    })
  ) {
    return {
      eligible: false,
      reason: "user_blocked" as const
    };
  }

  return {
    eligible: true
  };
}

async function logTriggerExecution(
  client: QueryClient,
  input: {
    actorAppUserId?: string;
    result: NotificationTriggerExecutionResultContract;
  }
) {
  try {
    await logActivity({
      client,
      userId: input.actorAppUserId ?? null,
      action: "notification_trigger_execute",
      entityType: "notification_trigger",
      entityId: input.result.sourceEntityId || randomUUID(),
      description: `Executed notification trigger ${input.result.eventType}.`,
      metadata: {
        eventType: input.result.eventType,
        sourceEntityType: input.result.sourceEntityType,
        sourceEntityId: input.result.sourceEntityId,
        templateKey: input.result.templateKey,
        status: input.result.status,
        targetUsersCount: input.result.targetUsersCount,
        preparedCount: input.result.preparedCount,
        skippedCount: input.result.skippedCount
      },
      afterPayload: input.result
    });
  } catch (error) {
    console.error("notification_trigger_log_failed", error);
  }
}

function createErrorResult(
  eventType: NotificationTriggerInputContract["eventType"],
  details: {
    sourceEntityType?: string;
    sourceEntityId?: string;
    templateKey?: string | null;
    error: string;
    skippedRecipients?: SkippedNotificationRecipientContract[];
  }
): NotificationTriggerExecutionResultContract {
  return {
    eventType,
    sourceEntityType: details.sourceEntityType ?? "notification_trigger",
    sourceEntityId: details.sourceEntityId ?? randomUUID(),
    templateKey: details.templateKey ?? null,
    status: "error",
    targetUsersCount: 0,
    preparedCount: 0,
    skippedCount: details.skippedRecipients?.length ?? 0,
    preparedNotifications: [],
    skippedRecipients: details.skippedRecipients ?? [],
    error: details.error,
    triggeredAt: new Date()
  };
}

export async function executeNotificationTrigger(
  input: NotificationTriggerInputContract,
  options: {
    actorAppUserId?: string;
    client?: QueryClient;
  } = {}
): Promise<NotificationTriggerExecutionResultContract> {
  const client = options.client ?? db;

  let parsedInput: NotificationTriggerInputContract;

  try {
    parsedInput = executeNotificationTriggerSchema.parse(input);
  } catch (error) {
    const result = createErrorResult(input.eventType, {
      error:
        error instanceof Error
          ? error.message
          : "Invalid notification trigger payload.",
      skippedRecipients: [
        {
          userId: null,
          reason: "payload_invalid"
        }
      ]
    });

    await logTriggerExecution(client, {
      actorAppUserId: options.actorAppUserId,
      result
    });

    return result;
  }

  try {
    const resolved = await resolveTriggerExecution(client, parsedInput);
    const preparedNotifications: PreparedEmailNotificationRecipientContract[] = [];
    const skippedRecipients: SkippedNotificationRecipientContract[] = [];
    const emailChannelEnabled = await getEmailChannelEnabledSetting(client);
    const whatsappSettings = await getWhatsAppDeliverySettings({
      client
    });
    const smsSettings = await getSmsDeliverySettings({
      client
    });

    for (const target of resolved.targets) {
      const eligibility = evaluateRecipientEligibility(target, {
        requireUnblocked: resolved.requireUnblocked
      });

      if (!eligibility.eligible) {
        skippedRecipients.push({
          userId: target.user.id,
          reason: eligibility.reason
        });
      }
    }

    const eligibleTargets = resolved.targets.filter(
      (target) =>
        !skippedRecipients.some((skipped) => skipped.userId === target.user.id)
    );

    if (eligibleTargets.length === 0) {
      const result: NotificationTriggerExecutionResultContract = {
        eventType: parsedInput.eventType,
        sourceEntityType: resolved.sourceEntityType,
        sourceEntityId: resolved.sourceEntityId,
        templateKey: resolved.templateKey,
        status: "no_targets",
        targetUsersCount: resolved.targets.length,
        preparedCount: 0,
        skippedCount: skippedRecipients.length,
        preparedNotifications,
        skippedRecipients,
        error: null,
        triggeredAt: new Date()
      };

      await logTriggerExecution(client, {
        actorAppUserId: options.actorAppUserId,
        result
      });

      return result;
    }

    try {
      for (const target of eligibleTargets) {
        const preferences = await getUserPreferences(target.user.id, {
          client
        });
        const hasAtLeastOneChannelEnabled =
          preferences.emailEnabled ||
          preferences.whatsappEnabled ||
          preferences.smsEnabled ||
          preferences.inAppEnabled;

        if (!hasAtLeastOneChannelEnabled) {
          continue;
        }

        const locale =
          preferences.preferredLanguage ??
          resolveLocale(target.user.preferredLanguage);
        const variables =
          locale === "ar" ? target.variablesAr : target.variablesEn;

        const rendered = await renderNotificationEmailTemplate({
          client,
          templateKey: resolved.templateKey,
          locale,
          variables
        });

        let renderedEn = locale === "en" ? rendered : null;
        let renderedAr = locale === "ar" ? rendered : null;

        if (!renderedEn) {
          try {
            renderedEn = await renderNotificationEmailTemplate({
              client,
              templateKey: resolved.templateKey,
              locale: "en",
              variables: target.variablesEn
            });
          } catch (error) {
            console.error("notification_trigger_in_app_render_en_failed", error);
            renderedEn = rendered;
          }
        }

        if (!renderedAr) {
          try {
            renderedAr = await renderNotificationEmailTemplate({
              client,
              templateKey: resolved.templateKey,
              locale: "ar",
              variables: target.variablesAr
            });
          } catch (error) {
            console.error("notification_trigger_in_app_render_ar_failed", error);
            renderedAr = rendered;
          }
        }

        const normalizedEmail = normalizeEmail(target.user.email);
        let emailOutcome: "sent" | "failed" | "disabled" = "disabled";

        if (!preferences.emailEnabled || !emailChannelEnabled) {
          emailOutcome = "disabled";
        } else if (!normalizedEmail) {
          emailOutcome = "failed";
          skippedRecipients.push({
            userId: target.user.id,
            reason: "user_email_missing"
          });
          await reportNotificationFailure({
            channel: "email",
            provider: "internal_template_render",
            reason: "user_email_missing",
            error: "Email delivery skipped because user email is missing.",
            recipientUserId: target.user.id,
            sourceEntityType: resolved.sourceEntityType,
            sourceEntityId: resolved.sourceEntityId,
            eventType: parsedInput.eventType,
            actorAppUserId: options.actorAppUserId ?? null,
            client
          });
        } else if (!isValidEmail(normalizedEmail)) {
          emailOutcome = "failed";
          skippedRecipients.push({
            userId: target.user.id,
            reason: "invalid_email"
          });
          await reportNotificationFailure({
            channel: "email",
            provider: "internal_template_render",
            reason: "invalid_email",
            error: "Email delivery skipped because user email is invalid.",
            recipientUserId: target.user.id,
            sourceEntityType: resolved.sourceEntityType,
            sourceEntityId: resolved.sourceEntityId,
            eventType: parsedInput.eventType,
            actorAppUserId: options.actorAppUserId ?? null,
            client
          });
        } else {
          emailOutcome = "sent";
          preparedNotifications.push({
            userId: target.user.id,
            email: normalizedEmail,
            locale,
            templateId: rendered.templateId,
            templateKey: rendered.templateKey,
            templateType: rendered.templateType,
            subject: rendered.renderedSubject,
            body: rendered.renderedBody,
            variables,
            missingVariables: rendered.missingVariables,
            unexpectedVariables: rendered.unexpectedVariables
          });
        }

        let whatsappOutcome: "sent" | "failed" | "disabled" = "disabled";
        const shouldAttemptWhatsApp =
          preferences.whatsappEnabled && emailOutcome !== "sent";

        if (shouldAttemptWhatsApp) {
          try {
            const whatsappResult = await sendWhatsAppMessage(
              {
                type: resolved.sourceEntityType,
                recipientUserId: target.user.id,
                phoneNumber: target.user.phone,
                locale,
                title: {
                  en: renderedEn.renderedSubject,
                  ar: renderedAr.renderedSubject
                },
                body: {
                  en: renderedEn.renderedBody,
                  ar: renderedAr.renderedBody
                },
                variables,
                metadata: {
                  eventType: parsedInput.eventType,
                  sourceEntityType: resolved.sourceEntityType,
                  sourceEntityId: resolved.sourceEntityId,
                  templateKey: resolved.templateKey,
                  locale,
                  emailChannelEnabled,
                  emailOutcome,
                  preferences,
                  missingVariables: rendered.missingVariables,
                  unexpectedVariables: rendered.unexpectedVariables
                }
              },
              {
                actorAppUserId: options.actorAppUserId,
                client,
                settings: whatsappSettings
              }
            );

            if (whatsappResult.status === "sent") {
              whatsappOutcome = "sent";
            } else if (
              whatsappResult.status === "skipped" &&
              whatsappResult.reason === "disabled"
            ) {
              whatsappOutcome = "disabled";
            } else {
              whatsappOutcome = "failed";
            }
          } catch (error) {
            whatsappOutcome = whatsappSettings.enabled ? "failed" : "disabled";
            console.error("notification_trigger_whatsapp_send_failed", error);
          }
        }

        if (preferences.inAppEnabled) {
          try {
            await createNotification(
              target.user.id,
              {
                type: resolved.sourceEntityType,
                title: {
                  en: renderedEn.renderedSubject,
                  ar: renderedAr.renderedSubject
                },
                body: {
                  en: renderedEn.renderedBody,
                  ar: renderedAr.renderedBody
                },
                metadata: {
                  eventType: parsedInput.eventType,
                  sourceEntityType: resolved.sourceEntityType,
                  sourceEntityId: resolved.sourceEntityId,
                  templateKey: resolved.templateKey,
                  emailLocale: locale,
                  emailChannelEnabled,
                  emailOutcome,
                  whatsappOutcome,
                  preferences,
                  missingVariables: rendered.missingVariables,
                  unexpectedVariables: rendered.unexpectedVariables
                }
              },
              {
                actorAppUserId: options.actorAppUserId,
                client
              }
            );
          } catch (error) {
            console.error("notification_trigger_in_app_create_failed", error);
          }
        }

        const shouldAttemptSmsFallback =
          preferences.smsEnabled &&
          emailOutcome !== "sent" &&
          whatsappOutcome !== "sent" &&
          isValidSmsPhoneNumber(target.user.phone);

        if (shouldAttemptSmsFallback) {
          try {
            await sendSms(
              {
                type: resolved.sourceEntityType,
                recipientUserId: target.user.id,
                phoneNumber: target.user.phone,
                locale,
                title: {
                  en: renderedEn.renderedSubject,
                  ar: renderedAr.renderedSubject
                },
                body: {
                  en: renderedEn.renderedBody,
                  ar: renderedAr.renderedBody
                },
                variables,
                metadata: {
                  eventType: parsedInput.eventType,
                  sourceEntityType: resolved.sourceEntityType,
                  sourceEntityId: resolved.sourceEntityId,
                  templateKey: resolved.templateKey,
                  locale,
                  emailChannelEnabled,
                  emailOutcome,
                  whatsappOutcome,
                  preferences,
                  missingVariables: rendered.missingVariables,
                  unexpectedVariables: rendered.unexpectedVariables
                }
              },
              {
                actorAppUserId: options.actorAppUserId,
                client,
                settings: smsSettings
              }
            );
          } catch (error) {
            console.error("notification_trigger_sms_send_failed", error);
          }
        }
      }
    } catch (error) {
      if (
        error instanceof NotificationEmailTemplatesServiceError &&
        error.code === ERROR_CODES.emailTemplateNotFound
      ) {
        for (const target of eligibleTargets) {
          skippedRecipients.push({
            userId: target.user.id,
            reason: "template_missing"
          });
          await reportNotificationFailure({
            channel: "email",
            provider: "internal_template_render",
            reason: "template_missing",
            error: "Email template is missing for the trigger event.",
            recipientUserId: target.user.id,
            sourceEntityType: resolved.sourceEntityType,
            sourceEntityId: resolved.sourceEntityId,
            eventType: parsedInput.eventType,
            actorAppUserId: options.actorAppUserId ?? null,
            client
          });
        }

        const result: NotificationTriggerExecutionResultContract = {
          eventType: parsedInput.eventType,
          sourceEntityType: resolved.sourceEntityType,
          sourceEntityId: resolved.sourceEntityId,
          templateKey: resolved.templateKey,
          status: "template_missing",
          targetUsersCount: resolved.targets.length,
          preparedCount: 0,
          skippedCount: skippedRecipients.length,
          preparedNotifications: [],
          skippedRecipients,
          error: null,
          triggeredAt: new Date()
        };

        await logTriggerExecution(client, {
          actorAppUserId: options.actorAppUserId,
          result
        });

        return result;
      }

      throw error;
    }

    const result: NotificationTriggerExecutionResultContract = {
      eventType: parsedInput.eventType,
      sourceEntityType: resolved.sourceEntityType,
      sourceEntityId: resolved.sourceEntityId,
      templateKey: resolved.templateKey,
      status: preparedNotifications.length > 0 ? "prepared" : "no_targets",
      targetUsersCount: resolved.targets.length,
      preparedCount: preparedNotifications.length,
      skippedCount: skippedRecipients.length,
      preparedNotifications,
      skippedRecipients,
      error: null,
      triggeredAt: new Date()
    };

    await logTriggerExecution(client, {
      actorAppUserId: options.actorAppUserId,
      result
    });

    return result;
  } catch (error) {
    const result = createErrorResult(parsedInput.eventType, {
      error:
        error instanceof Error
          ? error.message
          : "Notification trigger execution failed."
    });

    await logTriggerExecution(client, {
      actorAppUserId: options.actorAppUserId,
      result
    });

    return result;
  }
}
