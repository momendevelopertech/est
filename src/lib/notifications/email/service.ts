import { Prisma, type PrismaClient } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";

import type {
  NotificationEmailRenderResultContract,
  NotificationEmailPreviewResultContract,
  NotificationEmailPreviewVariablesContract,
  NotificationEmailTemplateContract,
  NotificationEmailTemplateListContract,
  UpsertNotificationEmailTemplateResultContract
} from "./contracts";
import type {
  NotificationEmailPreviewInput,
  NotificationEmailTemplatesQuery,
  UpsertNotificationEmailTemplateInput
} from "./validation";

const placeholderSyntaxPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
const placeholderVariablePattern = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;

const emailTemplateSelect = {
  id: true,
  key: true,
  type: true,
  subjectAr: true,
  subjectEn: true,
  bodyAr: true,
  bodyEn: true,
  variables: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.EmailTemplateSelect;

type EmailTemplateRecord = Prisma.EmailTemplateGetPayload<{
  select: typeof emailTemplateSelect;
}>;

type TransactionClient = Prisma.TransactionClient;
type QueryClient = TransactionClient | PrismaClient;

type NormalizedTemplateMutationInput = Omit<
  UpsertNotificationEmailTemplateInput,
  "key" | "type" | "variables" | "subject" | "body"
> & {
  key: string;
  type: string;
  variables: string[];
  subject: {
    ar: string;
    en: string;
  };
  body: {
    ar: string;
    en: string;
  };
};

export class NotificationEmailTemplatesServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "NotificationEmailTemplatesServiceError";
  }
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeTemplateVariables(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    throw new NotificationEmailTemplatesServiceError(
      ERROR_CODES.invalidTemplateVariables,
      500,
      "Stored template variables are invalid."
    );
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new NotificationEmailTemplatesServiceError(
        ERROR_CODES.invalidTemplateVariables,
        500,
        "Stored template variables must be a string array."
      );
    }

    const variable = entry.trim();

    if (!placeholderVariablePattern.test(variable)) {
      throw new NotificationEmailTemplatesServiceError(
        ERROR_CODES.invalidTemplateVariables,
        500,
        "Stored template variables include an invalid placeholder name.",
        {
          variable
        }
      );
    }

    if (!seen.has(variable)) {
      normalized.push(variable);
      seen.add(variable);
    }
  }

  return normalized;
}

function extractPlaceholdersFromText(
  content: string,
  fieldName: string
): string[] {
  const used = new Set<string>();
  const matcher = new RegExp(placeholderSyntaxPattern.source, "g");
  let match: RegExpExecArray | null;

  while (true) {
    match = matcher.exec(content);

    if (!match) {
      break;
    }

    const variable = match[1].trim();

    if (!placeholderVariablePattern.test(variable)) {
      throw new NotificationEmailTemplatesServiceError(
        ERROR_CODES.invalidTemplatePlaceholder,
        400,
        "Template placeholder names are invalid.",
        {
          field: fieldName,
          placeholder: variable
        }
      );
    }

    used.add(variable);
  }

  const sanitized = content.replace(
    new RegExp(placeholderSyntaxPattern.source, "g"),
    ""
  );

  if (sanitized.includes("{{") || sanitized.includes("}}")) {
    throw new NotificationEmailTemplatesServiceError(
      ERROR_CODES.invalidTemplatePlaceholder,
      400,
      "Template placeholder syntax is invalid.",
      {
        field: fieldName
      }
    );
  }

  return Array.from(used).sort((a, b) => a.localeCompare(b));
}

function collectTemplatePlaceholders(template: {
  subject: { ar: string; en: string };
  body: { ar: string; en: string };
}): string[] {
  const used = new Set<string>();
  const fields: Array<[string, string]> = [
    ["subject.ar", template.subject.ar],
    ["subject.en", template.subject.en],
    ["body.ar", template.body.ar],
    ["body.en", template.body.en]
  ];

  for (const [fieldName, value] of fields) {
    for (const placeholder of extractPlaceholdersFromText(value, fieldName)) {
      used.add(placeholder);
    }
  }

  return Array.from(used).sort((a, b) => a.localeCompare(b));
}

function assertDeclaredVariablesCoverTemplate(
  declaredVariables: string[],
  templateVariables: string[]
) {
  const declaredSet = new Set(declaredVariables);
  const undeclared = templateVariables.filter(
    (variable) => !declaredSet.has(variable)
  );

  if (undeclared.length > 0) {
    throw new NotificationEmailTemplatesServiceError(
      ERROR_CODES.invalidTemplateVariables,
      400,
      "Template content uses placeholders that are not declared in variables.",
      {
        undeclaredVariables: undeclared
      }
    );
  }
}

function normalizePreviewVariables(
  variables: NotificationEmailPreviewInput["variables"]
): NotificationEmailPreviewVariablesContract {
  const normalizedEntries = Object.entries(variables).map(([key, value]) => {
    const normalizedKey = key.trim();

    if (!placeholderVariablePattern.test(normalizedKey)) {
      throw new NotificationEmailTemplatesServiceError(
        ERROR_CODES.invalidTemplateVariables,
        400,
        "Preview variables include an invalid placeholder key.",
        {
          variable: normalizedKey
        }
      );
    }

    return [normalizedKey, value] as const;
  });

  return Object.fromEntries(normalizedEntries);
}

function normalizeTemplateMutationInput(
  input: UpsertNotificationEmailTemplateInput
): NormalizedTemplateMutationInput {
  return {
    ...input,
    key: input.key.trim().toLowerCase(),
    type: input.type.trim().toLowerCase(),
    variables: Array.from(new Set(input.variables.map((value) => value.trim()))).sort(
      (a, b) => a.localeCompare(b)
    ),
    subject: {
      ar: input.subject.ar.trim(),
      en: input.subject.en.trim()
    },
    body: {
      ar: input.body.ar.trim(),
      en: input.body.en.trim()
    }
  };
}

function renderTemplateText(
  templateText: string,
  variables: NotificationEmailPreviewVariablesContract,
  missingVariables: Set<string>
) {
  return templateText.replace(
    new RegExp(placeholderSyntaxPattern.source, "g"),
    (_fullMatch, rawVariable: string) => {
      const variable = rawVariable.trim();
      const value = variables[variable];

      if (value === undefined || value === null) {
        missingVariables.add(variable);
        return "";
      }

      return String(value);
    }
  );
}

function toTemplateContract(record: EmailTemplateRecord): NotificationEmailTemplateContract {
  return {
    id: record.id,
    key: record.key,
    type: record.type,
    isActive: record.isActive,
    variables: normalizeTemplateVariables(record.variables),
    subject: {
      ar: record.subjectAr,
      en: record.subjectEn
    },
    body: {
      ar: record.bodyAr,
      en: record.bodyEn
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

async function assertTemplateKeyUnique(
  tx: TransactionClient,
  key: string,
  options: {
    excludeTemplateId?: string;
  } = {}
) {
  const existing = await tx.emailTemplate.findFirst({
    where: {
      key: {
        equals: key,
        mode: "insensitive"
      },
      ...(options.excludeTemplateId
        ? {
            id: {
              not: options.excludeTemplateId
            }
          }
        : {})
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throw new NotificationEmailTemplatesServiceError(
      ERROR_CODES.duplicateEmailTemplateKey,
      409,
      "An email template with the same key already exists."
    );
  }
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2025") {
    throw new NotificationEmailTemplatesServiceError(
      ERROR_CODES.emailTemplateNotFound,
      404,
      "Email template not found."
    );
  }

  if (isKnownPrismaError(error) && error.code === "P2002") {
    throw new NotificationEmailTemplatesServiceError(
      ERROR_CODES.duplicateEmailTemplateKey,
      409,
      "An email template with the same key already exists.",
      error.meta ?? null
    );
  }

  throw error;
}

async function findTemplateByKey(
  client: QueryClient,
  templateKey: string,
  options: {
    includeInactive?: boolean;
  } = {}
) {
  return client.emailTemplate.findFirst({
    where: {
      key: {
        equals: templateKey,
        mode: "insensitive"
      },
      ...(options.includeInactive ? {} : { isActive: true })
    },
    select: emailTemplateSelect
  });
}

async function findTemplateById(
  client: QueryClient,
  templateId: string,
  options: {
    includeInactive?: boolean;
  } = {}
) {
  return client.emailTemplate.findFirst({
    where: {
      id: templateId,
      ...(options.includeInactive ? {} : { isActive: true })
    },
    select: emailTemplateSelect
  });
}

async function findTemplateForPreview(
  tx: TransactionClient,
  input: NotificationEmailPreviewInput
) {
  if (input.templateId) {
    return findTemplateById(tx, input.templateId, {
      includeInactive: true
    });
  }

  if (!input.templateKey) {
    return null;
  }

  return findTemplateByKey(tx, input.templateKey, {
    includeInactive: true
  });
}

export async function listNotificationEmailTemplates(
  query: NotificationEmailTemplatesQuery
): Promise<NotificationEmailTemplateListContract> {
  const records = await db.emailTemplate.findMany({
    where: {
      ...(query.type
        ? {
            type: {
              equals: query.type.trim().toLowerCase(),
              mode: "insensitive"
            }
          }
        : {}),
      ...(query.includeInactive ? {} : { isActive: true })
    },
    orderBy: [{ updatedAt: "desc" }, { key: "asc" }],
    select: emailTemplateSelect
  });

  const data = records.map((record) => toTemplateContract(record));

  return {
    data,
    total: data.length
  };
}

export async function upsertNotificationEmailTemplate(
  input: UpsertNotificationEmailTemplateInput & {
    actorAppUserId: string;
  }
): Promise<UpsertNotificationEmailTemplateResultContract> {
  const normalizedInput = normalizeTemplateMutationInput(input);
  const placeholders = collectTemplatePlaceholders({
    subject: normalizedInput.subject,
    body: normalizedInput.body
  });

  assertDeclaredVariablesCoverTemplate(normalizedInput.variables, placeholders);

  try {
    return await db.$transaction(
      async (tx) => {
        if (normalizedInput.templateId) {
          const before = await tx.emailTemplate.findUnique({
            where: {
              id: normalizedInput.templateId
            },
            select: emailTemplateSelect
          });

          if (!before) {
            throw new NotificationEmailTemplatesServiceError(
              ERROR_CODES.emailTemplateNotFound,
              404,
              "Email template not found."
            );
          }

          await assertTemplateKeyUnique(tx, normalizedInput.key, {
            excludeTemplateId: before.id
          });

          const updated = await tx.emailTemplate.update({
            where: {
              id: normalizedInput.templateId
            },
            data: {
              key: normalizedInput.key,
              type: normalizedInput.type,
              subjectAr: normalizedInput.subject.ar,
              subjectEn: normalizedInput.subject.en,
              bodyAr: normalizedInput.body.ar,
              bodyEn: normalizedInput.body.en,
              variables: normalizedInput.variables as Prisma.InputJsonValue,
              isActive: normalizedInput.isActive
            },
            select: emailTemplateSelect
          });

          await logActivity({
            client: tx,
            userId: input.actorAppUserId,
            action: "update_template",
            entityType: "email_template",
            entityId: updated.id,
            description: `Updated email template ${updated.key}.`,
            metadata: {
              templateKey: updated.key,
              templateType: updated.type,
              isActive: updated.isActive,
              variables: normalizedInput.variables
            },
            beforePayload: before,
            afterPayload: updated
          });

          return {
            mode: "updated",
            data: toTemplateContract(updated)
          };
        }

        await assertTemplateKeyUnique(tx, normalizedInput.key);

        const created = await tx.emailTemplate.create({
          data: {
            key: normalizedInput.key,
            type: normalizedInput.type,
            subjectAr: normalizedInput.subject.ar,
            subjectEn: normalizedInput.subject.en,
            bodyAr: normalizedInput.body.ar,
            bodyEn: normalizedInput.body.en,
            variables: normalizedInput.variables as Prisma.InputJsonValue,
            isActive: normalizedInput.isActive
          },
          select: emailTemplateSelect
        });

        await logActivity({
          client: tx,
          userId: input.actorAppUserId,
          action: "create_template",
          entityType: "email_template",
          entityId: created.id,
          description: `Created email template ${created.key}.`,
          metadata: {
            templateKey: created.key,
            templateType: created.type,
            isActive: created.isActive,
            variables: normalizedInput.variables
          },
          afterPayload: created
        });

        return {
          mode: "created",
          data: toTemplateContract(created)
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      }
    );
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function renderNotificationEmailTemplate(input: {
  templateKey: string;
  locale: "en" | "ar";
  variables: NotificationEmailPreviewVariablesContract;
  client?: QueryClient;
}): Promise<NotificationEmailRenderResultContract> {
  const locale = input.locale === "ar" ? "ar" : "en";
  const client = input.client ?? db;
  const templateRecord = await findTemplateByKey(client, input.templateKey);

  if (!templateRecord) {
    throw new NotificationEmailTemplatesServiceError(
      ERROR_CODES.emailTemplateNotFound,
      404,
      "Email template not found."
    );
  }

  const template = toTemplateContract(templateRecord);
  const previewVariables = normalizePreviewVariables(input.variables);
  const usedVariables = collectTemplatePlaceholders({
    subject: template.subject,
    body: template.body
  });

  assertDeclaredVariablesCoverTemplate(template.variables, usedVariables);

  const templateSubject = locale === "ar" ? template.subject.ar : template.subject.en;
  const templateBody = locale === "ar" ? template.body.ar : template.body.en;
  const declaredVariables = new Set(template.variables);
  const missingVariables = new Set<string>();
  const renderedSubject = renderTemplateText(
    templateSubject,
    previewVariables,
    missingVariables
  );
  const renderedBody = renderTemplateText(
    templateBody,
    previewVariables,
    missingVariables
  );
  const unexpectedVariables = Object.keys(previewVariables)
    .filter((variable) => !declaredVariables.has(variable))
    .sort((a, b) => a.localeCompare(b));
  const missingVariablesList = Array.from(missingVariables).sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    templateId: template.id,
    templateKey: template.key,
    templateType: template.type,
    locale,
    renderedSubject,
    renderedBody,
    usedVariables,
    missingVariables: missingVariablesList,
    unexpectedVariables
  };
}

export async function previewNotificationEmailTemplate(
  input: NotificationEmailPreviewInput & {
    actorAppUserId: string;
  }
): Promise<NotificationEmailPreviewResultContract> {
  const locale = input.locale === "ar" ? "ar" : "en";
  const previewVariables = normalizePreviewVariables(input.variables);

  return db.$transaction(
    async (tx) => {
      const templateRecord = await findTemplateForPreview(tx, input);

      if (!templateRecord) {
        throw new NotificationEmailTemplatesServiceError(
          ERROR_CODES.emailTemplateNotFound,
          404,
          "Email template not found."
        );
      }

      const result = await renderNotificationEmailTemplate({
        templateKey: templateRecord.key,
        locale,
        variables: previewVariables,
        client: tx
      });

      await logActivity({
        client: tx,
        userId: input.actorAppUserId,
        action: "preview_template",
        entityType: "email_template",
        entityId: result.templateId,
        description: `Previewed email template ${result.templateKey}.`,
        metadata: {
          templateKey: result.templateKey,
          templateType: result.templateType,
          locale,
          usedVariables: result.usedVariables,
          missingVariables: result.missingVariables,
          unexpectedVariables: result.unexpectedVariables
        }
      });

      return result;
    },
    {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    }
  );
}
