import { randomUUID } from "node:crypto";

import { ExamType, Prisma } from "@prisma/client";
import { z } from "zod";

import { logActivity } from "@/lib/activity/log";
import { parseCsvRows } from "@/lib/csv";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { MAX_IMPORT_ROW_COUNT } from "@/lib/import/constants";

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
      ERROR_CODES.missingRequiredField,
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
    createImportValidationError(ERROR_CODES.invalidInteger, `${fieldName} must be an integer.`, {
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
      ERROR_CODES.invalidExamType,
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
    throw new LocationsServiceError(
      ERROR_CODES.emptyImportFile,
      400,
      "The uploaded CSV file is empty."
    );
  }

  const header = rows[0].map((column) => trimCell(column));
  const missingColumns = locationImportColumns.filter((column) => !header.includes(column));
  const unexpectedColumns = header.filter(
    (column) => !locationImportColumns.includes(column as LocationImportColumn)
  );
  const duplicateColumns = header.filter((column, index) => header.indexOf(column) !== index);

  if (missingColumns.length > 0 || unexpectedColumns.length > 0 || duplicateColumns.length > 0) {
    throw new LocationsServiceError(
      ERROR_CODES.invalidImportHeaders,
      400,
      "The CSV file headers do not match the required locations import template.",
      {
        missingColumns,
        unexpectedColumns,
        duplicateColumns: Array.from(new Set(duplicateColumns))
      }
    );
  }

  const headerIndexMap = new Map<LocationImportColumn, number>();

  for (const column of locationImportColumns) {
    headerIndexMap.set(column, header.indexOf(column));
  }

  const dataRows = rows.slice(1);

  if (dataRows.length > MAX_IMPORT_ROW_COUNT) {
    throw new LocationsServiceError(
      ERROR_CODES.importRowLimitExceeded,
      400,
      `The CSV file exceeds the maximum of ${MAX_IMPORT_ROW_COUNT} rows.`,
      {
        maxRows: MAX_IMPORT_ROW_COUNT,
        receivedRows: dataRows.length
      }
    );
  }

  return dataRows.map((row, index) => {
    if (row.length > header.length) {
      throw new LocationsServiceError(
        ERROR_CODES.invalidImportStructure,
        400,
        "The CSV file contains rows with more columns than the header.",
        {
          row: index + 2,
          expectedColumns: header.length,
          receivedColumns: row.length
        }
      );
    }

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
      ERROR_CODES.missingRequiredField,
      "governorateName or governorateNameEn is required for every import row."
    );
  }

  if (
    hasUniversity &&
    !normalizeOptionalText(record.universityName) &&
    !normalizeOptionalText(record.universityNameEn)
  ) {
    createImportValidationError(
      ERROR_CODES.missingRequiredField,
      "universityName or universityNameEn is required when university data is present."
    );
  }

  if (hasBuilding && !hasUniversity) {
    createImportValidationError(
      ERROR_CODES.invalidHierarchyOrder,
      "Building data requires a university in the same row."
    );
  }

  if (
    hasBuilding &&
    !normalizeOptionalText(record.buildingName) &&
    !normalizeOptionalText(record.buildingNameEn)
  ) {
    createImportValidationError(
      ERROR_CODES.missingRequiredField,
      "buildingName or buildingNameEn is required when building data is present."
    );
  }

  if (hasFloor && !hasBuilding) {
    createImportValidationError(
      ERROR_CODES.invalidHierarchyOrder,
      "Floor data requires a building in the same row."
    );
  }

  if (
    hasFloor &&
    !normalizeOptionalText(record.floorName) &&
    !normalizeOptionalText(record.floorNameEn)
  ) {
    createImportValidationError(
      ERROR_CODES.missingRequiredField,
      "floorName or floorNameEn is required when floor data is present."
    );
  }

  if (hasRoom && !hasFloor) {
    createImportValidationError(
      ERROR_CODES.invalidHierarchyOrder,
      "Room data requires a floor in the same row."
    );
  }

  if (hasRoom) {
    if (!normalizeOptionalText(record.roomName) && !normalizeOptionalText(record.roomNameEn)) {
      createImportValidationError(
        ERROR_CODES.missingRequiredField,
        "roomName or roomNameEn is required when room data is present."
      );
    }

    if (!normalizeOptionalText(record.roomType)) {
      createImportValidationError(
        ERROR_CODES.missingRequiredField,
        "roomType is required when room data is present."
      );
    }

    if (!normalizeOptionalText(record.roomSupportedExamTypes)) {
      createImportValidationError(
        ERROR_CODES.missingRequiredField,
        "roomSupportedExamTypes is required when room data is present."
      );
    }

    if (!normalizeOptionalText(record.roomCapacityMax)) {
      createImportValidationError(
        ERROR_CODES.missingRequiredField,
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
      ERROR_CODES.ambiguousExistingMatch,
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
      ERROR_CODES.conflictingDuplicateMatch,
      `${entityType} code and names match different existing records.`,
      {
        entityType
      }
    );
  }

  const match = codeMatches[0] ?? nameMatches[0] ?? englishNameMatches[0] ?? matches[0];

  if (!match.isActive) {
    createImportValidationError(
      ERROR_CODES.inactiveParent,
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
    createImportValidationError(ERROR_CODES.missingRequiredField, "roomType is required.");
  }

  if (!supportedExamTypes || supportedExamTypes.length === 0) {
    createImportValidationError(
      ERROR_CODES.missingRequiredField,
      "roomSupportedExamTypes is required."
    );
  }

  if (capacityMax === undefined) {
    createImportValidationError(ERROR_CODES.missingRequiredField, "roomCapacityMax is required.");
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
    "Alexandria,\u0627\u0644\u0625\u0633\u0643\u0646\u062f\u0631\u064a\u0629,ALX,Arab Academy Abu Qir,\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0623\u0628\u0648 \u0642\u064a\u0631,AAST-ABQ,Faculty of Pharmacy,\u0645\u0628\u0646\u0649 \u0635\u064a\u062f\u0644\u0629,ABQ-PHAR,Abu Qir Alexandria,Second Floor,\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u062b\u0627\u0646\u064a,F2,2,Room 201,\u0642\u0627\u0639\u0629 201,201,Lecture Hall,EST1|EST2,25,40",
    "Cairo,\u0627\u0644\u0642\u0627\u0647\u0631\u0629,CAI,Arab Academy Sheraton,\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0634\u064a\u0631\u0627\u062a\u0648\u0646,AAST-SHE,Engineering Building A,\u0645\u0628\u0646\u0649 \u0647\u0646\u062f\u0633\u0629 A,SHE-A,Sheraton Cairo,First Floor,\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644,F1,1,Room A101,\u0642\u0627\u0639\u0629 A101,A101,Lecture Hall,EST1|EST2,20,45",
    "Giza,\u0627\u0644\u062c\u064a\u0632\u0629,GIZ,Arab Academy Smart Village,\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0633\u0645\u0627\u0631\u062a \u0641\u064a\u0644\u062f\u062c,AAST-SV,Building A,\u0645\u0628\u0646\u0649 A,SV-A,Smart Village Giza,First Floor,\u0627\u0644\u062f\u0648\u0631 \u0627\u0644\u0623\u0648\u0644,F1,1,Room A106,\u0642\u0627\u0639\u0629 A106,A106,Lecture Hall,EST1|EST2,25,35"
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
              code: ERROR_CODES.internalServerError,
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
      error: result.error?.code ?? ERROR_CODES.internalServerError,
      message: result.error?.message ?? "Unexpected import error."
    }));

  await logActivity({
    userId: params.actorAppUserId,
    action: "import",
    entityType: "locations_import",
    entityId: randomUUID(),
    description: `Imported locations from ${params.fileName ?? "uploaded CSV"}.`,
    metadata: {
      totalRows: summary.total,
      successRows: summary.success,
      failedRows: summary.failed,
      created: summary.created,
      fileName: params.fileName ?? null
    }
  });

  return {
    ok: true,
    summary,
    errors
  };
}
