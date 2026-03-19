import { randomUUID } from "node:crypto";

import { LocaleCode, Prisma, UserSource } from "@prisma/client";
import { z } from "zod";

import { parseCsvRows } from "@/lib/csv";
import { db } from "@/lib/db";

import {
  ProctorsServiceError,
  createActivityLogEntry,
  normalizeEmail,
  normalizeOptionalText,
  normalizePhone,
  proctorSelect
} from "./service";

const proctorImportColumns = [
  "name",
  "nameEn",
  "phone",
  "email",
  "nationalId",
  "source",
  "organization",
  "branch",
  "governorateCode",
  "governorateName",
  "governorateNameEn",
  "preferredLanguage",
  "status",
  "notes"
] as const;

type ProctorImportColumn = (typeof proctorImportColumns)[number];

const rowSchema = z.object({
  name: z.string(),
  nameEn: z.string(),
  phone: z.string(),
  email: z.string(),
  nationalId: z.string(),
  source: z.string(),
  organization: z.string(),
  branch: z.string(),
  governorateCode: z.string(),
  governorateName: z.string(),
  governorateNameEn: z.string(),
  preferredLanguage: z.string(),
  status: z.string(),
  notes: z.string()
});

type ParsedImportRow = z.infer<typeof rowSchema>;

type ImportRowResult = {
  row: number;
  success: boolean;
  action: "created" | "reused" | "failed";
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  };
};

type ImportSummary = {
  total: number;
  success: number;
  failed: number;
  created: number;
  reused: number;
};

export type ProctorsImportResult = {
  ok: true;
  summary: ImportSummary;
  errors: Array<{
    row: number;
    error: string;
    message: string;
    details?: Record<string, unknown> | null;
  }>;
};

function createImportValidationError(
  code: string,
  message: string,
  details?: Record<string, unknown> | null
): never {
  throw new ProctorsServiceError(code, 400, message, details ?? null);
}

function trimCell(value: string) {
  return value.trim();
}

function resolveLocalizedName(name: string, nameEn: string) {
  const arabicName = normalizeOptionalText(name);
  const englishName = normalizeOptionalText(nameEn);
  const fallbackName = arabicName ?? englishName;

  if (!fallbackName) {
    createImportValidationError(
      "missing_required_field",
      "name or nameEn is required for every imported proctor row.",
      {
        field: "name"
      }
    );
  }

  return {
    name: fallbackName,
    nameEn: englishName ?? (!arabicName ? fallbackName : undefined)
  };
}

function parsePreferredLanguage(value: string) {
  const normalized = normalizeOptionalText(value)?.toUpperCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized === "AR" || normalized === "ARABIC") {
    return LocaleCode.AR;
  }

  if (normalized === "EN" || normalized === "ENGLISH") {
    return LocaleCode.EN;
  }

  createImportValidationError(
    "invalid_preferred_language",
    "preferredLanguage must be AR or EN when provided.",
    {
      field: "preferredLanguage",
      value
    }
  );
}

function parseSource(value: string) {
  const normalized = normalizeOptionalText(value)?.toUpperCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized in UserSource) {
    return normalized as UserSource;
  }

  createImportValidationError("invalid_source", "source must be SPHINX, UNIVERSITY, or EXTERNAL.", {
    field: "source",
    value
  });
}

function parseActiveStatus(value: string) {
  const normalized = normalizeOptionalText(value)?.toLowerCase();

  if (!normalized) {
    return true;
  }

  if (["active", "true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["inactive", "false", "0", "no"].includes(normalized)) {
    return false;
  }

  createImportValidationError("invalid_status", "status must be active or inactive.", {
    field: "status",
    value
  });
}

function parseRows(csvText: string) {
  const rows = parseCsvRows(csvText);

  if (rows.length === 0) {
    throw new ProctorsServiceError("empty_import_file", 400, "The uploaded CSV file is empty.");
  }

  const header = rows[0].map((column) => trimCell(column));
  const missingColumns = proctorImportColumns.filter((column) => !header.includes(column));

  if (missingColumns.length > 0) {
    throw new ProctorsServiceError(
      "invalid_import_headers",
      400,
      `The CSV file is missing required columns: ${missingColumns.join(", ")}.`
    );
  }

  const headerIndexMap = new Map<ProctorImportColumn, number>();

  for (const column of proctorImportColumns) {
    headerIndexMap.set(column, header.indexOf(column));
  }

  return rows.slice(1).map((row, index) => {
    const rawRecord = Object.fromEntries(
      proctorImportColumns.map((column) => [column, row[headerIndexMap.get(column) ?? -1] ?? ""])
    );

    return {
      rowNumber: index + 2,
      record: rowSchema.parse(rawRecord)
    };
  });
}

function findMatchingRecord(
  candidates: Array<{
    id: string;
    phone: string;
    email: string | null;
    nationalId: string | null;
  }>,
  field: "phone" | "email" | "nationalId",
  value?: string
) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.toLowerCase();

  return (
    candidates.find((candidate) => {
      const candidateValue =
        field === "phone"
          ? candidate.phone
          : field === "email"
            ? candidate.email
            : candidate.nationalId;

      return candidateValue?.trim().toLowerCase() === normalizedValue;
    }) ?? null
  );
}

function chooseGovernorateMatch(
  matches: Array<{
    id: string;
    code: string | null;
    name: string;
    nameEn: string | null;
    isActive: boolean;
  }>,
  filters: {
    code?: string;
    name?: string;
    nameEn?: string;
  }
) {
  if (matches.length === 0) {
    return null;
  }

  const exactMatches = matches.filter((match) => {
    const codeMatches =
      !filters.code || match.code?.trim().toLowerCase() === filters.code.toLowerCase();
    const nameMatches =
      !filters.name || match.name.trim().toLowerCase() === filters.name.toLowerCase();
    const nameEnMatches =
      !filters.nameEn || match.nameEn?.trim().toLowerCase() === filters.nameEn.toLowerCase();

    return codeMatches && nameMatches && nameEnMatches;
  });

  const resolvedMatches = exactMatches.length > 0 ? exactMatches : matches;

  if (resolvedMatches.length > 1) {
    createImportValidationError(
      "ambiguous_governorate_match",
      "The governorate columns match multiple records. Use a more specific code or name.",
      {
        code: filters.code,
        name: filters.name,
        nameEn: filters.nameEn
      }
    );
  }

  return resolvedMatches[0];
}

async function resolveGovernorateId(
  tx: Prisma.TransactionClient,
  record: ParsedImportRow
) {
  const code = normalizeOptionalText(record.governorateCode);
  const name = normalizeOptionalText(record.governorateName);
  const nameEn = normalizeOptionalText(record.governorateNameEn);

  if (!code && !name && !nameEn) {
    return undefined;
  }

  const matches = await tx.governorate.findMany({
    where: {
      OR: [
        ...(code
          ? [
              {
                code: {
                  equals: code,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(name
          ? [
              {
                name: {
                  equals: name,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(nameEn
          ? [
              {
                nameEn: {
                  equals: nameEn,
                  mode: "insensitive" as const
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      code: true,
      name: true,
      nameEn: true,
      isActive: true
    }
  });

  const governorate = chooseGovernorateMatch(matches, {
    code,
    name,
    nameEn
  });

  if (!governorate) {
    createImportValidationError(
      "governorate_not_found",
      "The referenced governorate was not found.",
      {
        code,
        name,
        nameEn
      }
    );
  }

  if (!governorate.isActive) {
    createImportValidationError(
      "inactive_parent",
      "Cannot import a proctor into an inactive governorate.",
      {
        governorateId: governorate.id
      }
    );
  }

  return governorate.id;
}

async function processImportRow(
  tx: Prisma.TransactionClient,
  row: ParsedImportRow,
  rowNumber: number,
  actorAppUserId: string
): Promise<ImportRowResult> {
  const { name, nameEn } = resolveLocalizedName(row.name, row.nameEn);
  const rawPhone = normalizeOptionalText(row.phone);

  if (!rawPhone) {
    createImportValidationError("missing_required_field", "phone is required for every row.", {
      field: "phone"
    });
  }

  const phone = normalizePhone(rawPhone);
  const email = normalizeEmail(row.email);
  const nationalId = normalizeOptionalText(row.nationalId);
  const source = parseSource(row.source);
  const organization = normalizeOptionalText(row.organization);
  const branch = normalizeOptionalText(row.branch);
  const governorateId = await resolveGovernorateId(tx, row);
  const preferredLanguage = parsePreferredLanguage(row.preferredLanguage);
  const isActive = parseActiveStatus(row.status);
  const notes = normalizeOptionalText(row.notes);

  const candidates = await tx.user.findMany({
    where: {
      OR: [
        {
          phone: {
            equals: phone,
            mode: "insensitive"
          }
        },
        ...(email
          ? [
              {
                email: {
                  equals: email,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(nationalId
          ? [
              {
                nationalId: {
                  equals: nationalId,
                  mode: "insensitive" as const
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      nationalId: true
    }
  });

  const phoneMatch = findMatchingRecord(candidates, "phone", phone);
  const emailMatch = findMatchingRecord(candidates, "email", email);
  const nationalIdMatch = findMatchingRecord(candidates, "nationalId", nationalId);

  if (phoneMatch) {
    if (emailMatch && emailMatch.id !== phoneMatch.id) {
      createImportValidationError(
        "duplicate_email",
        "The imported email is already linked to a different proctor.",
        {
          field: "email",
          value: email,
          conflictingRecordId: emailMatch.id
        }
      );
    }

    if (nationalIdMatch && nationalIdMatch.id !== phoneMatch.id) {
      createImportValidationError(
        "duplicate_national_id",
        "The imported national ID is already linked to a different proctor.",
        {
          field: "nationalId",
          value: nationalId,
          conflictingRecordId: nationalIdMatch.id
        }
      );
    }

    if (
      email &&
      phoneMatch.email &&
      phoneMatch.email.trim().toLowerCase() !== email.toLowerCase()
    ) {
      createImportValidationError(
        "phone_reuse_email_mismatch",
        "The row matches an existing phone number but has a different email.",
        {
          field: "email",
          value: email,
          conflictingRecordId: phoneMatch.id
        }
      );
    }

    if (
      nationalId &&
      phoneMatch.nationalId &&
      phoneMatch.nationalId.trim().toLowerCase() !== nationalId.toLowerCase()
    ) {
      createImportValidationError(
        "phone_reuse_national_id_mismatch",
        "The row matches an existing phone number but has a different national ID.",
        {
          field: "nationalId",
          value: nationalId,
          conflictingRecordId: phoneMatch.id
        }
      );
    }

    return {
      row: rowNumber,
      success: true,
      action: "reused"
    };
  }

  if (emailMatch) {
    createImportValidationError(
      "duplicate_email",
      "The imported email is already linked to an existing proctor.",
      {
        field: "email",
        value: email,
        conflictingRecordId: emailMatch.id
      }
    );
  }

  if (nationalIdMatch) {
    createImportValidationError(
      "duplicate_national_id",
      "The imported national ID is already linked to an existing proctor.",
      {
        field: "nationalId",
        value: nationalId,
        conflictingRecordId: nationalIdMatch.id
      }
    );
  }

  if (!source) {
    createImportValidationError(
      "missing_required_field",
      "source is required when creating a new proctor.",
      {
        field: "source"
      }
    );
  }

  const created = await tx.user.create({
    data: {
      name,
      nameEn: nameEn ?? null,
      phone,
      email: email ?? null,
      nationalId: nationalId ?? null,
      source,
      organization: organization ?? null,
      branch: branch ?? null,
      governorateId: governorateId ?? null,
      preferredLanguage: preferredLanguage ?? null,
      isActive,
      notes: notes ?? null
    },
    select: proctorSelect
  });

  await tx.activityLog.create({
    data: createActivityLogEntry({
      actorAppUserId,
      action: "create",
      entityId: created.id,
      description: `Created proctor ${created.name} via import.`,
      metadata: {
        source: "import",
        rowNumber,
        phone: created.phone,
        email: created.email,
        governorateId: created.governorateId
      },
      afterPayload: created
    })
  });

  return {
    row: rowNumber,
    success: true,
    action: "created"
  };
}

export function getProctorsImportTemplateColumns() {
  return [...proctorImportColumns];
}

export function getProctorsImportSampleCsv() {
  return [
    proctorImportColumns.join(","),
    "محمد علي,Mohamed Ali,01001234567,m.ali@example.com,29801011234567,SPHINX,Sphinx,Heliopolis,CAI,Cairo,القاهرة,AR,active,Experienced room proctor",
    ",Nora Hassan,01002223333,nora.hassan@example.com,,UNIVERSITY,Cairo University,Main Campus,GIZ,Giza,الجيزة,EN,active,English-only import row uses bilingual fallback",
    "سارة عادل,Sara Adel,01003334444,,,EXTERNAL,External Pool,,ALEX,Alexandria,الإسكندرية,,inactive,"
  ].join("\n");
}

export async function importProctorsCsv(params: {
  actorAppUserId: string;
  csvText: string;
  fileName?: string | null;
}): Promise<ProctorsImportResult> {
  const parsedRows = parseRows(params.csvText);
  const results: ImportRowResult[] = [];

  for (const row of parsedRows) {
    try {
      const result = await db.$transaction((tx) =>
        processImportRow(tx, row.record, row.rowNumber, params.actorAppUserId)
      );
      results.push(result);
    } catch (error) {
      const normalizedError =
        error instanceof ProctorsServiceError
          ? {
              code: error.code,
              message: error.message,
              details:
                error.details && typeof error.details === "object"
                  ? (error.details as Record<string, unknown>)
                  : null
            }
          : {
              code: "unexpected_import_error",
              message: error instanceof Error ? error.message : "Unexpected import error.",
              details: null
            };

      results.push({
        row: row.rowNumber,
        success: false,
        action: "failed",
        error: normalizedError
      });
    }
  }

  const summary = results.reduce<ImportSummary>(
    (accumulator, result) => {
      accumulator.total += 1;

      if (result.success) {
        accumulator.success += 1;
      } else {
        accumulator.failed += 1;
      }

      if (result.action === "created") {
        accumulator.created += 1;
      }

      if (result.action === "reused") {
        accumulator.reused += 1;
      }

      return accumulator;
    },
    {
      total: 0,
      success: 0,
      failed: 0,
      created: 0,
      reused: 0
    }
  );

  const errors = results
    .filter((result) => !result.success && result.error)
    .map((result) => ({
      row: result.row,
      error: result.error?.code ?? "unexpected_import_error",
      message: result.error?.message ?? "Unexpected import error.",
      details: result.error?.details ?? null
    }));

  await db.activityLog.create({
    data: {
      actorAppUserId: params.actorAppUserId,
      action: "import",
      entityType: "proctors_import",
      entityId: randomUUID(),
      description: `Imported proctors from ${params.fileName ?? "uploaded CSV"}.`,
      metadata: {
        userId: params.actorAppUserId,
        action: "import",
        entityType: "proctors_import",
        totalRows: summary.total,
        successRows: summary.success,
        failedRows: summary.failed,
        createdRows: summary.created,
        reusedRows: summary.reused,
        fileName: params.fileName ?? null
      }
    }
  });

  return {
    ok: true,
    summary,
    errors
  };
}
