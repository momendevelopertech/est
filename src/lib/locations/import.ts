import { randomUUID } from "node:crypto";

import { ExamType, Prisma } from "@prisma/client";
import { z } from "zod";

import { parseCsvRows } from "@/lib/csv";
import { db } from "@/lib/db";

import { LocationsServiceError, validateRoomIntegrity } from "./service";

const locationImportColumns = [
  "governorateName",
  "governorateNameEn",
  "governorateCode",
  "universityName",
  "universityNameEn",
  "universityCode",
  "buildingName",
  "buildingNameEn",
  "buildingCode",
  "buildingAddress",
  "floorName",
  "floorNameEn",
  "floorCode",
  "floorLevelNumber",
  "roomName",
  "roomNameEn",
  "roomCode",
  "roomType",
  "roomSupportedExamTypes",
  "roomCapacityMin",
  "roomCapacityMax"
] as const;

type LocationImportColumn = (typeof locationImportColumns)[number];

const rowSchema = z.object({
  governorateName: z.string(),
  governorateNameEn: z.string(),
  governorateCode: z.string(),
  universityName: z.string(),
  universityNameEn: z.string(),
  universityCode: z.string(),
  buildingName: z.string(),
  buildingNameEn: z.string(),
  buildingCode: z.string(),
  buildingAddress: z.string(),
  floorName: z.string(),
  floorNameEn: z.string(),
  floorCode: z.string(),
  floorLevelNumber: z.string(),
  roomName: z.string(),
  roomNameEn: z.string(),
  roomCode: z.string(),
  roomType: z.string(),
  roomSupportedExamTypes: z.string(),
  roomCapacityMin: z.string(),
  roomCapacityMax: z.string()
});

type ParsedImportRow = z.infer<typeof rowSchema>;

type LocalizedImportName = {
  primaryName: string;
  englishName?: string;
};

type ImportRowResult = {
  row: number;
  success: boolean;
  created: {
    governorates: number;
    universities: number;
    buildings: number;
    floors: number;
    rooms: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

type ImportSummary = {
  total: number;
  success: number;
  failed: number;
  created: {
    governorates: number;
    universities: number;
    buildings: number;
    floors: number;
    rooms: number;
  };
};

export type LocationsImportResult = {
  ok: true;
  summary: ImportSummary;
  errors: Array<{
    row: number;
    error: string;
    message: string;
  }>;
};

function createImportValidationError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): never {
  throw new LocationsServiceError(code, 400, message, details ?? null);
}

function trimCell(value: string) {
  return value.trim();
}

function normalizeOptionalText(value: string) {
  const normalized = trimCell(value);
  return normalized.length > 0 ? normalized : undefined;
}

function resolveLocalizedName(
  primaryValue: string,
  englishValue: string,
  fieldBase: string
): LocalizedImportName {
  const primaryName = normalizeOptionalText(primaryValue);
  const englishName = normalizeOptionalText(englishValue);
  const fallbackName = primaryName ?? englishName;

  if (!fallbackName) {
    createImportValidationError(
      "missing_required_field",
      `${fieldBase} name is required when ${fieldBase} data is present.`
    );
  }

  return {
    primaryName: fallbackName,
    englishName: englishName ?? (!primaryName ? fallbackName : undefined)
  };
}

function parseInteger(value: string, fieldName: string) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed)) {
    createImportValidationError("invalid_integer", `${fieldName} must be an integer.`, {
      fieldName,
      value: normalized
    });
  }

  return parsed;
}

function parseExamTypes(value: string) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return undefined;
  }

  const parts = normalized
    .split(/[|,;]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);

  const uniqueParts = Array.from(new Set(parts));

  const invalid = uniqueParts.filter((part) => !(part in ExamType));

  if (invalid.length > 0) {
    createImportValidationError(
      "invalid_exam_type",
      `roomSupportedExamTypes contains invalid values: ${invalid.join(", ")}.`,
      {
        invalidValues: invalid
      }
    );
  }

  return uniqueParts as ExamType[];
}

function parseRows(csvText: string) {
  const rows = parseCsvRows(csvText);

  if (rows.length === 0) {
    throw new LocationsServiceError("empty_import_file", 400, "The uploaded CSV file is empty.");
  }

  const header = rows[0].map((column) => trimCell(column));
  const missingColumns = locationImportColumns.filter((column) => !header.includes(column));

  if (missingColumns.length > 0) {
    throw new LocationsServiceError(
      "invalid_import_headers",
      400,
      `The CSV file is missing required columns: ${missingColumns.join(", ")}.`
    );
  }

  const headerIndexMap = new Map<LocationImportColumn, number>();

  for (const column of locationImportColumns) {
    headerIndexMap.set(column, header.indexOf(column));
  }

  return rows.slice(1).map((row, index) => {
    const rawRecord = Object.fromEntries(
      locationImportColumns.map((column) => [column, row[headerIndexMap.get(column) ?? -1] ?? ""])
    );

    const record = rowSchema.parse(rawRecord);

    return {
      rowNumber: index + 2,
      record
    };
  });
}

function hasLevelData(record: ParsedImportRow, level: "governorate" | "university" | "building" | "floor" | "room") {
  const levelFields: Record<typeof level, string[]> = {
    governorate: [record.governorateName, record.governorateNameEn, record.governorateCode],
    university: [record.universityName, record.universityNameEn, record.universityCode],
    building: [record.buildingName, record.buildingNameEn, record.buildingCode, record.buildingAddress],
    floor: [record.floorName, record.floorNameEn, record.floorCode, record.floorLevelNumber],
    room: [
      record.roomName,
      record.roomNameEn,
      record.roomCode,
      record.roomType,
      record.roomSupportedExamTypes,
      record.roomCapacityMin,
      record.roomCapacityMax
    ]
  };

  return levelFields[level].some((value) => trimCell(value).length > 0);
}

function validateRowShape(record: ParsedImportRow) {
  const hasGovernorate = hasLevelData(record, "governorate");
  const hasUniversity = hasLevelData(record, "university");
  const hasBuilding = hasLevelData(record, "building");
  const hasFloor = hasLevelData(record, "floor");
  const hasRoom = hasLevelData(record, "room");

  if (!hasGovernorate) {
    createImportValidationError(
      "missing_required_field",
      "governorateName or governorateNameEn is required for every import row."
    );
  }

  if (
    hasUniversity &&
    !normalizeOptionalText(record.universityName) &&
    !normalizeOptionalText(record.universityNameEn)
  ) {
    createImportValidationError(
      "missing_required_field",
      "universityName or universityNameEn is required when university data is present."
    );
  }

  if (hasBuilding && !hasUniversity) {
    createImportValidationError(
      "invalid_hierarchy_order",
      "Building data requires a university in the same row."
    );
  }

  if (
    hasBuilding &&
    !normalizeOptionalText(record.buildingName) &&
    !normalizeOptionalText(record.buildingNameEn)
  ) {
    createImportValidationError(
      "missing_required_field",
      "buildingName or buildingNameEn is required when building data is present."
    );
  }

  if (hasFloor && !hasBuilding) {
    createImportValidationError(
      "invalid_hierarchy_order",
      "Floor data requires a building in the same row."
    );
  }

  if (
    hasFloor &&
    !normalizeOptionalText(record.floorName) &&
    !normalizeOptionalText(record.floorNameEn)
  ) {
    createImportValidationError(
      "missing_required_field",
      "floorName or floorNameEn is required when floor data is present."
    );
  }

  if (hasRoom && !hasFloor) {
    createImportValidationError(
      "invalid_hierarchy_order",
      "Room data requires a floor in the same row."
    );
  }

  if (hasRoom) {
    if (!normalizeOptionalText(record.roomName) && !normalizeOptionalText(record.roomNameEn)) {
      createImportValidationError(
        "missing_required_field",
        "roomName or roomNameEn is required when room data is present."
      );
    }

    if (!normalizeOptionalText(record.roomType)) {
      createImportValidationError(
        "missing_required_field",
        "roomType is required when room data is present."
      );
    }

    if (!normalizeOptionalText(record.roomSupportedExamTypes)) {
      createImportValidationError(
        "missing_required_field",
        "roomSupportedExamTypes is required when room data is present."
      );
    }

    if (!normalizeOptionalText(record.roomCapacityMax)) {
      createImportValidationError(
        "missing_required_field",
        "roomCapacityMax is required when room data is present."
      );
    }
  }
}

function chooseSingleMatch<
  T extends {
    id: string;
    name: string;
    nameEn?: string | null;
    code: string | null;
    isActive: boolean;
  }
>(
  entityType: string,
  matches: T[],
  code?: string,
  name?: string,
  nameEn?: string
) {
  if (matches.length === 0) {
    return null;
  }

  const codeMatches = code
    ? matches.filter((match) => match.code?.toLowerCase() === code.toLowerCase())
    : [];
  const nameMatches = name
    ? matches.filter((match) => match.name.toLowerCase() === name.toLowerCase())
    : [];
  const englishNameMatches = nameEn
    ? matches.filter((match) => match.nameEn?.toLowerCase() === nameEn.toLowerCase())
    : [];

  if (
    codeMatches.length > 1 ||
    nameMatches.length > 1 ||
    englishNameMatches.length > 1 ||
    matches.length > 1
  ) {
    createImportValidationError(
      "ambiguous_existing_match",
      `Multiple ${entityType} records matched the same import row.`,
      {
        entityType
      }
    );
  }

  const namedMatches = [codeMatches[0], nameMatches[0], englishNameMatches[0]].filter(Boolean);

  if (
    namedMatches.length > 1 &&
    new Set(namedMatches.map((match) => match?.id)).size > 1
  ) {
    createImportValidationError(
      "conflicting_duplicate_match",
      `${entityType} code and names match different existing records.`,
      {
        entityType
      }
    );
  }

  const match = codeMatches[0] ?? nameMatches[0] ?? englishNameMatches[0] ?? matches[0];

  if (!match.isActive) {
    createImportValidationError(
      "inactive_parent",
      `Cannot import into inactive ${entityType} "${match.name}".`,
      {
        entityType,
        entityId: match.id
      }
    );
  }

  return match;
}

async function resolveGovernorate(
  tx: Prisma.TransactionClient,
  record: ParsedImportRow
) {
  const { primaryName: name, englishName: nameEn } = resolveLocalizedName(
    record.governorateName,
    record.governorateNameEn,
    "governorate"
  );
  const code = normalizeOptionalText(record.governorateCode);

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
        {
          name: {
            equals: name,
            mode: "insensitive"
          }
        },
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
      name: true,
      nameEn: true,
      code: true,
      isActive: true
    }
  });

  const match = chooseSingleMatch("governorate", matches, code, name, nameEn);

  if (match) {
    return {
      id: match.id,
      created: false
    };
  }

  const created = await tx.governorate.create({
    data: {
      name,
      ...(nameEn ? { nameEn } : {}),
      ...(code ? { code } : {})
    },
    select: {
      id: true
    }
  });

  return {
    id: created.id,
    created: true
  };
}

async function resolveUniversity(
  tx: Prisma.TransactionClient,
  governorateId: string,
  record: ParsedImportRow
) {
  if (!hasLevelData(record, "university")) {
    return null;
  }

  const { primaryName: name, englishName: nameEn } = resolveLocalizedName(
    record.universityName,
    record.universityNameEn,
    "university"
  );
  const code = normalizeOptionalText(record.universityCode);

  const matches = await tx.university.findMany({
    where: {
      governorateId,
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
        {
          name: {
            equals: name,
            mode: "insensitive"
          }
        },
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
      name: true,
      nameEn: true,
      code: true,
      isActive: true
    }
  });

  const match = chooseSingleMatch("university", matches, code, name, nameEn);

  if (match) {
    return {
      id: match.id,
      created: false
    };
  }

  const created = await tx.university.create({
    data: {
      governorateId,
      name,
      ...(nameEn ? { nameEn } : {}),
      ...(code ? { code } : {})
    },
    select: {
      id: true
    }
  });

  return {
    id: created.id,
    created: true
  };
}

async function resolveBuilding(
  tx: Prisma.TransactionClient,
  universityId: string,
  record: ParsedImportRow
) {
  if (!hasLevelData(record, "building")) {
    return null;
  }

  const { primaryName: name, englishName: nameEn } = resolveLocalizedName(
    record.buildingName,
    record.buildingNameEn,
    "building"
  );
  const code = normalizeOptionalText(record.buildingCode);
  const address = normalizeOptionalText(record.buildingAddress);

  const matches = await tx.building.findMany({
    where: {
      universityId,
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
        {
          name: {
            equals: name,
            mode: "insensitive"
          }
        },
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
      name: true,
      nameEn: true,
      code: true,
      isActive: true
    }
  });

  const match = chooseSingleMatch("building", matches, code, name, nameEn);

  if (match) {
    return {
      id: match.id,
      created: false
    };
  }

  const created = await tx.building.create({
    data: {
      universityId,
      name,
      ...(nameEn ? { nameEn } : {}),
      ...(code ? { code } : {}),
      ...(address ? { address } : {})
    },
    select: {
      id: true
    }
  });

  return {
    id: created.id,
    created: true
  };
}

async function resolveFloor(
  tx: Prisma.TransactionClient,
  buildingId: string,
  record: ParsedImportRow
) {
  if (!hasLevelData(record, "floor")) {
    return null;
  }

  const { primaryName: name, englishName: nameEn } = resolveLocalizedName(
    record.floorName,
    record.floorNameEn,
    "floor"
  );
  const code = normalizeOptionalText(record.floorCode);
  const levelNumber = parseInteger(record.floorLevelNumber, "floorLevelNumber");

  const matches = await tx.floor.findMany({
    where: {
      buildingId,
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
        {
          name: {
            equals: name,
            mode: "insensitive"
          }
        },
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
      name: true,
      nameEn: true,
      code: true,
      isActive: true
    }
  });

  const match = chooseSingleMatch("floor", matches, code, name, nameEn);

  if (match) {
    return {
      id: match.id,
      created: false
    };
  }

  const created = await tx.floor.create({
    data: {
      buildingId,
      name,
      ...(nameEn ? { nameEn } : {}),
      ...(code ? { code } : {}),
      ...(levelNumber !== undefined ? { levelNumber } : {})
    },
    select: {
      id: true
    }
  });

  return {
    id: created.id,
    created: true
  };
}

async function resolveRoom(
  tx: Prisma.TransactionClient,
  floorId: string,
  record: ParsedImportRow
) {
  if (!hasLevelData(record, "room")) {
    return null;
  }

  const { primaryName: name, englishName: nameEn } = resolveLocalizedName(
    record.roomName,
    record.roomNameEn,
    "room"
  );
  const code = normalizeOptionalText(record.roomCode);
  const roomType = normalizeOptionalText(record.roomType);
  const supportedExamTypes = parseExamTypes(record.roomSupportedExamTypes);
  const capacityMin = parseInteger(record.roomCapacityMin, "roomCapacityMin") ?? 0;
  const capacityMax = parseInteger(record.roomCapacityMax, "roomCapacityMax");

  if (!roomType) {
    createImportValidationError("missing_required_field", "roomType is required.");
  }

  if (!supportedExamTypes || supportedExamTypes.length === 0) {
    createImportValidationError("missing_required_field", "roomSupportedExamTypes is required.");
  }

  if (capacityMax === undefined) {
    createImportValidationError("missing_required_field", "roomCapacityMax is required.");
  }

  validateRoomIntegrity({
    supportedExamTypes,
    capacityMin,
    capacityMax
  });

  const matches = await tx.room.findMany({
    where: {
      floorId,
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
        {
          name: {
            equals: name,
            mode: "insensitive"
          }
        },
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
      name: true,
      nameEn: true,
      code: true,
      isActive: true
    }
  });

  const match = chooseSingleMatch("room", matches, code, name, nameEn);

  if (match) {
    return {
      id: match.id,
      created: false
    };
  }

  const created = await tx.room.create({
    data: {
      floorId,
      name,
      roomType,
      supportedExamTypes,
      capacityMin,
      capacityMax,
      ...(nameEn ? { nameEn } : {}),
      ...(code ? { code } : {})
    },
    select: {
      id: true
    }
  });

  return {
    id: created.id,
    created: true
  };
}

async function processImportRow(
  tx: Prisma.TransactionClient,
  row: ParsedImportRow,
  rowNumber: number
): Promise<ImportRowResult> {
  validateRowShape(row);

  const created = {
    governorates: 0,
    universities: 0,
    buildings: 0,
    floors: 0,
    rooms: 0
  };

  const governorate = await resolveGovernorate(tx, row);
  created.governorates += governorate.created ? 1 : 0;

  const university = await resolveUniversity(tx, governorate.id, row);
  if (!university) {
    return {
      row: rowNumber,
      success: true,
      created
    };
  }
  created.universities += university.created ? 1 : 0;

  const building = await resolveBuilding(tx, university.id, row);
  if (!building) {
    return {
      row: rowNumber,
      success: true,
      created
    };
  }
  created.buildings += building.created ? 1 : 0;

  const floor = await resolveFloor(tx, building.id, row);
  if (!floor) {
    return {
      row: rowNumber,
      success: true,
      created
    };
  }
  created.floors += floor.created ? 1 : 0;

  const room = await resolveRoom(tx, floor.id, row);
  if (room) {
    created.rooms += room.created ? 1 : 0;
  }

  return {
    row: rowNumber,
    success: true,
    created
  };
}

export function getLocationsImportTemplateColumns() {
  return [...locationImportColumns];
}

export function getLocationsImportSampleCsv() {
  return [
    locationImportColumns.join(","),
    "Cairo,\u0627\u0644\u0642\u0627\u0647\u0631\u0629,CAI,Helwan University,\u062c\u0627\u0645\u0639\u0629 \u062d\u0644\u0648\u0627\u0646,HU,Engineering Building,\u0645\u0628\u0646\u0649 \u0627\u0644\u0647\u0646\u062f\u0633\u0629,ENG-1,,First Floor,\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644,F1,1,Room 101,\u0642\u0627\u0639\u0629 101,R101,Lecture Hall,EST1|EST2,20,40",
    "Giza,\u0627\u0644\u062c\u064a\u0632\u0629,GIZ,Cairo University,\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0642\u0627\u0647\u0631\u0629,CU,,,,,,,,,,,,,,,",
    "Alexandria,\u0627\u0644\u0625\u0633\u0643\u0646\u062f\u0631\u064a\u0629,ALEX,Alex University,\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0633\u0643\u0646\u062f\u0631\u064a\u0629,AU,Science Building,\u0645\u0628\u0646\u0649 \u0627\u0644\u0639\u0644\u0648\u0645,SCI,,,,,,,,,,,,"
  ].join("\n");
}

export async function importLocationsCsv(params: {
  actorAppUserId: string;
  csvText: string;
  fileName?: string | null;
}): Promise<LocationsImportResult> {
  const parsedRows = parseRows(params.csvText);
  const results: ImportRowResult[] = [];

  for (const row of parsedRows) {
    try {
      const result = await db.$transaction((tx) =>
        processImportRow(tx, row.record, row.rowNumber)
      );
      results.push(result);
    } catch (error) {
      const normalizedError =
        error instanceof LocationsServiceError
          ? {
              code: error.code,
              message: error.message
            }
          : {
              code: "unexpected_import_error",
              message: error instanceof Error ? error.message : "Unexpected import error."
            };

      results.push({
        row: row.rowNumber,
        success: false,
        created: {
          governorates: 0,
          universities: 0,
          buildings: 0,
          floors: 0,
          rooms: 0
        },
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

      accumulator.created.governorates += result.created.governorates;
      accumulator.created.universities += result.created.universities;
      accumulator.created.buildings += result.created.buildings;
      accumulator.created.floors += result.created.floors;
      accumulator.created.rooms += result.created.rooms;

      return accumulator;
    },
    {
      total: 0,
      success: 0,
      failed: 0,
      created: {
        governorates: 0,
        universities: 0,
        buildings: 0,
        floors: 0,
        rooms: 0
      }
    }
  );

  const errors = results
    .filter((result) => !result.success && result.error)
    .map((result) => ({
      row: result.row,
      error: result.error?.code ?? "unexpected_import_error",
      message: result.error?.message ?? "Unexpected import error."
    }));

  await db.activityLog.create({
    data: {
      actorAppUserId: params.actorAppUserId,
      action: "import",
      entityType: "locations_import",
      entityId: randomUUID(),
      description: `Imported locations from ${params.fileName ?? "uploaded CSV"}.`,
      metadata: {
        userId: params.actorAppUserId,
        action: "import",
        entityType: "locations_import",
        totalRows: summary.total,
        successRows: summary.success,
        failedRows: summary.failed,
        created: summary.created,
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
