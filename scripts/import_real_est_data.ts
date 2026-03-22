import { spawnSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import {
  AppUserRole,
  AssignmentMethod,
  AssignmentStatus,
  BlockStatus,
  CycleStatus,
  ExamType,
  LocaleCode,
  OperationalRoleScope,
  PrismaClient,
  SessionStatus,
  UserSource
} from "@prisma/client";
import { hash } from "bcryptjs";

type ExtractedPersonRow = {
  sourceFile: string;
  sourceSheet: string;
  nameEn: string;
  nameAr: string;
  email: string;
  phone: string;
  nationalId: string;
  insuranceNumber: string;
  organization: string;
  roleLabel: string;
  governorate: string;
  preferredCenter: string;
  building: string;
  location: string;
  typeLabel: string;
  division: string;
};

type ExtractedLocationRow = {
  sourceFile: string;
  sourceSheet: string;
  governorate: string;
  university: string;
  building: string;
  floor: string;
  room: string;
  roomType: string;
  classCapacity: number | null;
  examCapacity: number | null;
  est1Admitted: number | null;
  est2Admitted: number | null;
  isPaperStore: boolean;
};

type ExtractedFinalRosterRow = {
  sourceFile: string;
  sourceSheet: string;
  serial: string;
  roomEst1: string;
  roomEst2: string;
  division: string;
  nameEn: string;
  nameAr: string;
  email: string;
  phone: string;
  organization: string;
  insuranceNumber: string;
  nationalId: string;
  preferredCenter: string;
  roleLabel: string;
  typeLabel: string;
  governorate: string;
  building: string;
  location: string;
  newOld: string;
};

type ExtractedPayload = {
  baseDir: string;
  stats: {
    peopleRows: number;
    locationRows: number;
    finalRosterRows: number;
  };
  peopleRows: ExtractedPersonRow[];
  locationRows: ExtractedLocationRow[];
  finalRosterRows: ExtractedFinalRosterRow[];
};

type GovernorateSeed = {
  key: string;
  code: string;
  nameEn: string;
  nameAr: string;
  aliases: string[];
};

type UniversitySeed = {
  key: string;
  code: string;
  nameEn: string;
  nameAr: string;
  governorateKey: string;
  aliases: string[];
};

type CanonicalBuilding = {
  key: string;
  code: string;
  nameEn: string;
  nameAr: string;
  lookup: string;
  universityKey: string;
};

type FloorSeed = {
  key: string;
  buildingKey: string;
  nameEn: string;
  nameAr: string;
  levelNumber: number | null;
  isActive: boolean;
  notes: Set<string>;
};

type RoomSeed = {
  key: string;
  buildingKey: string;
  floorKey: string;
  name: string;
  lookup: string;
  roomType: string;
  supportedExamTypes: Set<ExamType>;
  capacityMin: number;
  capacityMax: number;
  isActive: boolean;
  notes: Set<string>;
};

type PersonSeed = {
  key: string;
  nameEn: string;
  nameAr: string;
  email: string;
  phone: string;
  nationalId: string;
  insuranceNumber: string;
  organization: string;
  governorate: string;
  preferredCenter: string;
  building: string;
  location: string;
  typeLabel: string;
  division: string;
  source: UserSource;
  sourceFiles: Set<string>;
  notes: Set<string>;
};

type AssignmentSeed = {
  sessionExamType: ExamType;
  userKey: string;
  buildingKey: string;
  floorKey: string | null;
  roomKey: string | null;
  roleKey: string;
  sourceSerial: string;
};

loadEnvConfig(process.cwd());

const extractorResult = spawnSync(
  "python",
  ["scripts/extract_real_est_data.py", "--base-dir", process.env.REAL_EST_DATA_DIR ?? "e:\\est files"],
  {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8"
    },
    maxBuffer: 64 * 1024 * 1024
  }
);

if (extractorResult.status !== 0) {
  throw new Error(extractorResult.stderr || "Failed to extract EST data files.");
}

const extracted = JSON.parse(extractorResult.stdout) as ExtractedPayload;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
    }
  }
});

const governorateSeeds: GovernorateSeed[] = [
  {
    key: "ALEXANDRIA",
    code: "ALX",
    nameEn: "Alexandria",
    nameAr: "\u0627\u0644\u0625\u0633\u0643\u0646\u062f\u0631\u064a\u0629",
    aliases: ["alexandria", "alex", "alx"]
  },
  {
    key: "CAIRO",
    code: "CAI",
    nameEn: "Cairo",
    nameAr: "\u0627\u0644\u0642\u0627\u0647\u0631\u0629",
    aliases: ["cairo", "new cairo", "sheraton"]
  },
  {
    key: "GIZA",
    code: "GIZ",
    nameEn: "Giza",
    nameAr: "\u0627\u0644\u062c\u064a\u0632\u0629",
    aliases: ["giza", "smart village"]
  },
  {
    key: "DAMIETTA",
    code: "DMT",
    nameEn: "Damietta",
    nameAr: "\u062f\u0645\u064a\u0627\u0637",
    aliases: ["damietta", "damitte"]
  },
  {
    key: "MENOUFIA",
    code: "MNF",
    nameEn: "Menoufia",
    nameAr: "\u0627\u0644\u0645\u0646\u0648\u0641\u064a\u0629",
    aliases: ["menoufia", "menofya", "menofia", "sadat city", "el sadat city"]
  },
  {
    key: "MINYA",
    code: "MNY",
    nameEn: "Minya",
    nameAr: "\u0627\u0644\u0645\u0646\u064a\u0627",
    aliases: ["minya"]
  },
  {
    key: "OMAN",
    code: "OMN",
    nameEn: "Oman",
    nameAr: "\u0639\u0645\u0627\u0646",
    aliases: ["oman"]
  }
];

const universitySeeds: UniversitySeed[] = [
  {
    key: "AAST_ABU_QIR",
    code: "AAST-ABQ",
    nameEn: "Arab Academy Abu Qir",
    nameAr: "\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0623\u0628\u0648 \u0642\u064a\u0631",
    governorateKey: "ALEXANDRIA",
    aliases: ["arab academy abu qir", "abu qir", "aastm abu qir", "aast abu qir"]
  },
  {
    key: "AAST_SHERATON",
    code: "AAST-SHE",
    nameEn: "Arab Academy Sheraton",
    nameAr: "\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0634\u064a\u0631\u0627\u062a\u0648\u0646",
    governorateKey: "CAIRO",
    aliases: ["arab academy sheraton", "sheraton"]
  },
  {
    key: "AAST_SMART_VILLAGE",
    code: "AAST-SV",
    nameEn: "Arab Academy Smart Village",
    nameAr: "\u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0633\u0645\u0627\u0631\u062a \u0641\u064a\u0644\u062f\u062c",
    governorateKey: "GIZA",
    aliases: ["arab academy smart village", "smart village"]
  },
  {
    key: "FUTURE",
    code: "FUE",
    nameEn: "Future University in Egypt",
    nameAr: "\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0645\u0633\u062a\u0642\u0628\u0644 \u0641\u064a \u0645\u0635\u0631",
    governorateKey: "CAIRO",
    aliases: ["future university in egypt", "future university", "fue"]
  },
  {
    key: "AL_RYADA",
    code: "RST",
    nameEn: "Al Ryada University for Science and Technology",
    nameAr: "\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0631\u064a\u0627\u062f\u0629 \u0644\u0644\u0639\u0644\u0648\u0645 \u0648\u0627\u0644\u062a\u0643\u0646\u0648\u0644\u0648\u062c\u064a\u0627",
    governorateKey: "MENOUFIA",
    aliases: ["al ryada university", "al ryada", "ryada", "rst"]
  },
  {
    key: "HORUS",
    code: "HUE",
    nameEn: "Horus University - Egypt ( HUE )",
    nameAr: "\u062c\u0627\u0645\u0639\u0629 \u062d\u0648\u0631\u0633 \u0645\u0635\u0631",
    governorateKey: "DAMIETTA",
    aliases: ["horus university", "hue"]
  },
  {
    key: "DERAYA",
    code: "DER",
    nameEn: "Deraya University",
    nameAr: "\u062c\u0627\u0645\u0639\u0629 \u062f\u0631\u0627\u064a\u0629",
    governorateKey: "MINYA",
    aliases: ["deraya university", "deraya"]
  }
];

const roleDefinitions = [
  ["building_head", "\u0647\u064a\u062f", "Head", OperationalRoleScope.BUILDING, false, 10, true],
  ["control_room", "\u0643\u0646\u062a\u0631\u0648\u0644", "Control Room", OperationalRoleScope.BUILDING, true, 20, true],
  ["floor_senior", "\u0633\u0646\u064a\u0648\u0631", "Senior", OperationalRoleScope.FLOOR, false, 30, true],
  ["roaming_monitor", "\u0631\u0648\u0645\u064a\u0646\u062c", "Roaming", OperationalRoleScope.FLOOR, false, 40, true],
  ["room_proctor", "\u0628\u0631\u0648\u0643\u062a\u0648\u0631", "Proctor", OperationalRoleScope.ROOM, false, 50, true],
  ["assn_manual", "\u0628\u0631\u0648\u0643\u062a\u0648\u0631 ASSN", "ASSN Proctor", OperationalRoleScope.ROOM, true, 60, true],
  ["service_support", "\u062e\u062f\u0645\u0627\u062a", "Service", OperationalRoleScope.BUILDING, true, 70, false],
  ["supervisor", "\u0645\u0634\u0631\u0641", "Supervisor", OperationalRoleScope.BUILDING, true, 80, false],
  ["assistant_supervisor", "\u0645\u0633\u0627\u0639\u062f \u0645\u0634\u0631\u0641", "Assistant Supervisor", OperationalRoleScope.BUILDING, true, 90, false],
  ["in_out_support", "\u062f\u062e\u0648\u0644 \u0648\u062e\u0631\u0648\u062c", "In/Out", OperationalRoleScope.BUILDING, true, 100, false],
  ["validation_support", "\u0641\u0627\u0644\u064a\u062f\u064a\u0634\u0646", "Validation", OperationalRoleScope.BUILDING, true, 110, false]
] as const;

const roleAliasMap = new Map<string, string>([
  ["head of est", "building_head"],
  ["head", "building_head"],
  ["control room assistant", "control_room"],
  ["control room", "control_room"],
  ["senior", "floor_senior"],
  ["external senior", "floor_senior"],
  ["senior external", "floor_senior"],
  ["roaming", "roaming_monitor"],
  ["proctor", "room_proctor"],
  ["service", "service_support"],
  ["supervisor", "supervisor"],
  ["assistant supervisor", "assistant_supervisor"],
  ["in out", "in_out_support"],
  ["in/out", "in_out_support"],
  ["validation", "validation_support"]
]);

const specialBuildingAliases = new Map<string, string>([
  ["arab academy sheraton a", "Arab Academy Sheraton Faculty of Engineering Building A"],
  ["arab academy abu qir faculty of engineering buildingd", "Arab Academy Abu Qir Faculty of Engineering Building D"],
  ["al ryada university for science and technology faculty of physical theraby", "Al Ryada University for Science and Technology - Faculty of Physical Therapy"]
]);

const governorateAliasMap = new Map<string, GovernorateSeed>();
for (const seed of governorateSeeds) {
  for (const alias of [seed.nameEn, seed.code, ...seed.aliases]) {
    governorateAliasMap.set(normalizeLookup(alias), seed);
  }
}

const universityAliasMap = new Map<string, UniversitySeed>();
for (const seed of universitySeeds) {
  for (const alias of [seed.nameEn, seed.code, ...seed.aliases]) {
    universityAliasMap.set(normalizeLookup(alias), seed);
  }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeLookup(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/buildingd/gi, "building d")
    .replace(/theraby/gi, "therapy")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeRoomLookup(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/lecture hall/gi, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, "")
    .replace(/#/g, "")
    .replace(/\.0/g, "")
    .toUpperCase();
}

function normalizePhone(value: string | null | undefined) {
  const compact = normalizeText(value).replace(/[\s\-().]/g, "");
  if (!compact) {
    return "";
  }
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\+/g, "")}`;
  }
  return compact.replace(/\+/g, "");
}

function slugify(value: string) {
  return (
    normalizeLookup(value)
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase() || "AUTO"
  );
}

function pickFirst(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (normalizeText(value)) {
      return normalizeText(value);
    }
  }
  return "";
}

function resolveGovernorate(raw: string | null | undefined) {
  const direct = governorateAliasMap.get(normalizeLookup(raw));
  if (direct) {
    return direct;
  }
  return governorateAliasMap.get("cairo")!;
}

function resolveUniversity(raw: string | null | undefined) {
  const lookup = normalizeLookup(raw);
  for (const [alias, seed] of universityAliasMap.entries()) {
    if (lookup.includes(alias)) {
      return seed;
    }
  }
  if (lookup.includes("abu qir")) {
    return universityAliasMap.get("arab academy abu qir")!;
  }
  if (lookup.includes("sheraton")) {
    return universityAliasMap.get("arab academy sheraton")!;
  }
  if (lookup.includes("smart village")) {
    return universityAliasMap.get("arab academy smart village")!;
  }
  if (lookup.includes("future")) {
    return universityAliasMap.get("future university in egypt")!;
  }
  if (lookup.includes("ryada") || lookup.includes("sadat")) {
    return universityAliasMap.get("al ryada university")!;
  }
  if (lookup.includes("horus") || lookup.includes("hue")) {
    return universityAliasMap.get("horus university")!;
  }
  if (lookup.includes("deraya")) {
    return universityAliasMap.get("deraya university")!;
  }
  return universityAliasMap.get("future university in egypt")!;
}

function scoreTokenOverlap(left: string, right: string) {
  const leftTokens = new Set(normalizeLookup(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeLookup(right).split(" ").filter(Boolean));
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}

const canonicalBuildings = new Map<string, CanonicalBuilding>();
const buildingLookupToKey = new Map<string, string>();
const floorSeeds = new Map<string, FloorSeed>();
const roomSeeds = new Map<string, RoomSeed>();
const peopleSeeds: PersonSeed[] = [];
const sessionBuildingKeys = new Map<ExamType, Set<string>>([
  [ExamType.EST1, new Set<string>()],
  [ExamType.EST2, new Set<string>()]
]);
const assignmentSeeds: AssignmentSeed[] = [];
const skippedAssignments: Array<{ serial: string; name: string; reason: string }> = [];

function upsertBuilding(nameEn: string, universityKey: string) {
  const canonicalName = specialBuildingAliases.get(normalizeLookup(nameEn)) || nameEn;
  const lookup = normalizeLookup(canonicalName);
  const existingKey = buildingLookupToKey.get(lookup);
  if (existingKey) {
    return canonicalBuildings.get(existingKey)!;
  }

  const building: CanonicalBuilding = {
    key: `${universityKey}::${slugify(canonicalName)}`,
    code: slugify(canonicalName).slice(0, 48) || "BLD",
    nameEn: canonicalName,
    nameAr: canonicalName,
    lookup,
    universityKey
  };
  canonicalBuildings.set(building.key, building);
  buildingLookupToKey.set(lookup, building.key);
  return building;
}

function findExistingBuilding(rawBuilding: string, universityKey: string) {
  const directLookup = normalizeLookup(specialBuildingAliases.get(normalizeLookup(rawBuilding)) || rawBuilding);
  const directKey = buildingLookupToKey.get(directLookup);
  if (directKey) {
    return canonicalBuildings.get(directKey)!;
  }

  const candidates = [...canonicalBuildings.values()].filter(
    (building) => building.universityKey === universityKey
  );
  const scored = candidates
    .map((building) => ({
      building,
      score: scoreTokenOverlap(rawBuilding, building.nameEn)
    }))
    .filter((item) => item.score > 1)
    .sort((left, right) => right.score - left.score);

  if (scored.length && (!scored[1] || scored[0].score > scored[1].score)) {
    return scored[0].building;
  }

  return null;
}

function resolveBuilding(rawBuilding: string, fallbackUniversity: UniversitySeed) {
  const value = normalizeText(rawBuilding);
  if (!value) {
    return null;
  }
  return (
    findExistingBuilding(value, fallbackUniversity.key) ||
    upsertBuilding(specialBuildingAliases.get(normalizeLookup(value)) || value, fallbackUniversity.key)
  );
}

function ordinalLabel(level: number) {
  if (level === 0) {
    return "Ground Floor";
  }
  if (level === 1) {
    return "1st Floor";
  }
  if (level === 2) {
    return "2nd Floor";
  }
  if (level === 3) {
    return "3rd Floor";
  }
  return `${level}th Floor`;
}

function inferFloorLevel(rawFloor: string, room: string) {
  const floorLookup = normalizeLookup(rawFloor);
  if (/^\d+$/.test(floorLookup)) {
    return Number.parseInt(floorLookup, 10);
  }
  const floorMatch = floorLookup.match(/^(\d)(st|nd|rd|th) floor$/);
  if (floorMatch) {
    return Number.parseInt(floorMatch[1], 10);
  }
  if (floorLookup === "ground floor" || floorLookup === "0") {
    return 0;
  }

  const roomLookup = normalizeRoomLookup(room);
  const dotted = roomLookup.match(/^[A-Z]+(\d)\./);
  if (dotted) {
    return Number.parseInt(dotted[1], 10);
  }
  const triple = roomLookup.match(/^[A-Z]*?(\d{3})$/);
  if (triple) {
    return Number.parseInt(triple[1].slice(0, 1), 10);
  }
  return null;
}

function ensureFloor(buildingKey: string, rawFloor: string, room: string, isActive: boolean, note: string) {
  const level = inferFloorLevel(rawFloor, room);
  const nameEn = normalizeText(rawFloor) || (level !== null ? ordinalLabel(level) : "General Floor");
  const key = `${buildingKey}::${normalizeLookup(nameEn)}`;
  const existing = floorSeeds.get(key);
  if (existing) {
    existing.isActive = existing.isActive || isActive;
    existing.notes.add(note);
    return existing;
  }

  const created: FloorSeed = {
    key,
    buildingKey,
    nameEn,
    nameAr: nameEn,
    levelNumber: level,
    isActive,
    notes: new Set([note])
  };
  floorSeeds.set(key, created);
  return created;
}

function ensureRoom(
  buildingKey: string,
  rawFloor: string,
  roomName: string,
  roomType: string,
  supportedExamTypes: Iterable<ExamType>,
  capacityMax: number,
  capacityMin: number,
  isActive: boolean,
  note: string
) {
  const lookup = normalizeRoomLookup(roomName);
  const floor = ensureFloor(buildingKey, rawFloor, roomName, isActive, note);
  const key = `${buildingKey}::${lookup}`;
  const existing = roomSeeds.get(key);
  if (existing) {
    for (const examType of supportedExamTypes) {
      existing.supportedExamTypes.add(examType);
    }
    existing.capacityMax = Math.max(existing.capacityMax, capacityMax);
    existing.capacityMin = Math.max(existing.capacityMin, capacityMin);
    existing.isActive = existing.isActive || isActive;
    existing.notes.add(note);
    return existing;
  }

  const created: RoomSeed = {
    key,
    buildingKey,
    floorKey: floor.key,
    name: roomName,
    lookup,
    roomType,
    supportedExamTypes: new Set(supportedExamTypes),
    capacityMin,
    capacityMax,
    isActive,
    notes: new Set([note])
  };
  roomSeeds.set(key, created);
  return created;
}

function classifyUserSource(row: Pick<ExtractedPersonRow, "organization" | "typeLabel" | "division" | "preferredCenter">) {
  const lookup = normalizeLookup(
    `${row.organization} ${row.typeLabel} ${row.division} ${row.preferredCenter}`
  );
  if (lookup.includes("sphinx") || normalizeText(row.typeLabel).toUpperCase() === "IP") {
    return UserSource.SPHINX;
  }
  if (
    lookup.includes("employee") ||
    lookup.includes("university") ||
    normalizeText(row.typeLabel).toUpperCase() === "EP"
  ) {
    return UserSource.UNIVERSITY;
  }
  return UserSource.EXTERNAL;
}

function upsertPerson(row: ExtractedPersonRow) {
  const email = normalizeText(row.email).toLowerCase();
  const phone = normalizePhone(row.phone);
  const nationalId = normalizeText(row.nationalId);
  const nameLookup = normalizeLookup(row.nameEn);

  const existing = peopleSeeds.find((person) => {
    if (email && person.email === email) {
      return true;
    }
    if (phone && person.phone === phone) {
      return true;
    }
    if (nationalId && person.nationalId === nationalId) {
      return true;
    }
    return nameLookup && normalizeLookup(person.nameEn) === nameLookup;
  });

  if (existing) {
    existing.nameEn = pickFirst(existing.nameEn, row.nameEn);
    existing.nameAr = pickFirst(existing.nameAr, row.nameAr);
    existing.email = pickFirst(existing.email, email);
    existing.phone = pickFirst(existing.phone, phone);
    existing.nationalId = pickFirst(existing.nationalId, nationalId);
    existing.insuranceNumber = pickFirst(existing.insuranceNumber, row.insuranceNumber);
    existing.organization = pickFirst(existing.organization, row.organization);
    existing.governorate = pickFirst(existing.governorate, row.governorate);
    existing.preferredCenter = pickFirst(existing.preferredCenter, row.preferredCenter);
    existing.building = pickFirst(existing.building, row.building);
    existing.location = pickFirst(existing.location, row.location);
    existing.typeLabel = pickFirst(existing.typeLabel, row.typeLabel);
    existing.division = pickFirst(existing.division, row.division);
    existing.sourceFiles.add(row.sourceFile);
    return existing;
  }

  const created: PersonSeed = {
    key: "",
    nameEn: normalizeText(row.nameEn),
    nameAr: normalizeText(row.nameAr),
    email,
    phone,
    nationalId,
    insuranceNumber: normalizeText(row.insuranceNumber),
    organization: normalizeText(row.organization),
    governorate: normalizeText(row.governorate),
    preferredCenter: normalizeText(row.preferredCenter),
    building: normalizeText(row.building),
    location: normalizeText(row.location),
    typeLabel: normalizeText(row.typeLabel),
    division: normalizeText(row.division),
    source: classifyUserSource(row),
    sourceFiles: new Set([row.sourceFile]),
    notes: new Set()
  };
  peopleSeeds.push(created);
  return created;
}

function finalizePeople() {
  let syntheticCounter = 1;
  for (const person of peopleSeeds) {
    if (!person.phone) {
      person.phone = `+2099900${String(syntheticCounter).padStart(6, "0")}`;
      person.notes.add("source_missing_phone");
      syntheticCounter += 1;
    }
    person.key = person.nationalId || person.email || person.phone || slugify(person.nameEn);
  }
}

function roomIsAssigned(room: string) {
  const lookup = normalizeLookup(room);
  return Boolean(lookup) && lookup !== "n a" && lookup !== "0";
}

function resolveRoleKey(roleLabel: string, roomEst1: string, roomEst2: string) {
  const direct = roleAliasMap.get(normalizeLookup(roleLabel));
  if (direct) {
    return direct;
  }
  if (normalizeLookup(`${roomEst1} ${roomEst2}`).includes("floor")) {
    return "roaming_monitor";
  }
  return "room_proctor";
}

function buildBaseLocations() {
  for (const row of extracted.locationRows) {
    const university = resolveUniversity(`${row.university} ${row.building} ${row.governorate}`);
    const building = upsertBuilding(row.building, university.key);
    const examTypes = new Set<ExamType>();
    if ((row.est1Admitted ?? 0) > 0) {
      examTypes.add(ExamType.EST1);
    }
    if ((row.est2Admitted ?? 0) > 0) {
      examTypes.add(ExamType.EST2);
    }
    if (!examTypes.size) {
      examTypes.add(ExamType.EST1);
      examTypes.add(ExamType.EST2);
    }

    ensureRoom(
      building.key,
      row.floor,
      row.room,
      row.isPaperStore ? "paper_store" : row.roomType || "exam_hall",
      examTypes,
      Math.max(1, row.examCapacity ?? row.classCapacity ?? row.est1Admitted ?? row.est2Admitted ?? 1),
      0,
      row.roomType === "control_room" || (row.est1Admitted ?? 0) > 0 || (row.est2Admitted ?? 0) > 0,
      `${row.sourceFile}:${row.sourceSheet}`
    );
  }
}

function getRoomCandidates(room: string, universityKey?: string, buildingKey?: string) {
  const lookup = normalizeRoomLookup(room);
  return [...roomSeeds.values()].filter((seed) => {
    if (seed.lookup !== lookup) {
      return false;
    }
    if (buildingKey && seed.buildingKey !== buildingKey) {
      return false;
    }
    if (universityKey) {
      const building = canonicalBuildings.get(seed.buildingKey);
      return building?.universityKey === universityKey;
    }
    return true;
  });
}

function findPersonForFinalRow(row: ExtractedFinalRosterRow) {
  const email = normalizeText(row.email).toLowerCase();
  const phone = normalizePhone(row.phone);
  const nationalId = normalizeText(row.nationalId);
  const nameLookup = normalizeLookup(row.nameEn);
  return (
    peopleSeeds.find((person) => {
      if (email && person.email === email) {
        return true;
      }
      if (phone && person.phone === phone) {
        return true;
      }
      if (nationalId && person.nationalId === nationalId) {
        return true;
      }
      return nameLookup && normalizeLookup(person.nameEn) === nameLookup;
    }) ?? null
  );
}

function ensureFallbackRoom(buildingKey: string, room: string, examType: ExamType, note: string) {
  const resolved = ensureRoom(buildingKey, "", room, "exam_hall", [examType], 1, 0, true, note);
  return resolved;
}

function processFinalRoster() {
  const roomMinCounts = new Map<string, number>();

  for (const personRow of extracted.peopleRows) {
    upsertPerson(personRow);
  }
  finalizePeople();

  for (const row of extracted.finalRosterRows) {
    const person = findPersonForFinalRow(row);
    if (!person) {
      skippedAssignments.push({ serial: row.serial, name: row.nameEn, reason: "person_not_found" });
      continue;
    }

    const preferredUniversity = resolveUniversity(
      `${row.preferredCenter} ${row.building} ${person.preferredCenter} ${person.building}`
    );
    const preferredBuilding =
      resolveBuilding(pickFirst(row.building, person.building), preferredUniversity) ?? null;
    const roleKey = resolveRoleKey(row.roleLabel, row.roomEst1, row.roomEst2);
    const role = roleDefinitions.find((entry) => entry[0] === roleKey);

    if (!role) {
      skippedAssignments.push({ serial: row.serial, name: row.nameEn, reason: `unknown_role_${roleKey}` });
      continue;
    }

    for (const [examType, roomValue] of [
      [ExamType.EST1, row.roomEst1],
      [ExamType.EST2, row.roomEst2]
    ] as const) {
      if (!roomIsAssigned(roomValue)) {
        continue;
      }

      let building = preferredBuilding;
      let roomSeed =
        role[3] === OperationalRoleScope.ROOM
          ? getRoomCandidates(roomValue, preferredUniversity.key, preferredBuilding?.key ?? undefined)[0] ?? null
          : null;

      if (!building && roomSeed) {
        building = canonicalBuildings.get(roomSeed.buildingKey) ?? null;
      }

      if (!building) {
        const candidates = getRoomCandidates(roomValue, preferredUniversity.key);
        if (candidates.length === 1) {
          roomSeed = roomSeed ?? candidates[0];
          building = canonicalBuildings.get(candidates[0].buildingKey) ?? null;
        }
      }

      if (!building) {
        skippedAssignments.push({ serial: row.serial, name: row.nameEn, reason: "building_not_resolved" });
        continue;
      }

      let floorKey: string | null = null;
      let roomKey: string | null = null;

      if (role[3] === OperationalRoleScope.FLOOR) {
        floorKey = ensureFloor(building.key, roomValue, roomValue, true, `${row.sourceFile}:${row.serial}`).key;
      }

      if (role[3] === OperationalRoleScope.ROOM) {
        const resolved =
          roomSeed ??
          ensureFallbackRoom(building.key, roomValue, examType, `${row.sourceFile}:${row.serial}`);
        floorKey = resolved.floorKey;
        roomKey = resolved.key;
        roomMinCounts.set(`${examType}:${roomKey}`, (roomMinCounts.get(`${examType}:${roomKey}`) ?? 0) + 1);
      }

      sessionBuildingKeys.get(examType)?.add(building.key);
      assignmentSeeds.push({
        sessionExamType: examType,
        userKey: person.key,
        buildingKey: building.key,
        floorKey,
        roomKey,
        roleKey,
        sourceSerial: row.serial
      });
    }
  }

  for (const room of roomSeeds.values()) {
    room.capacityMin = Math.max(
      room.capacityMin,
      roomMinCounts.get(`${ExamType.EST1}:${room.key}`) ?? 0,
      roomMinCounts.get(`${ExamType.EST2}:${room.key}`) ?? 0
    );
    room.capacityMax = Math.max(room.capacityMax, room.capacityMin || 1);
  }
}

async function resetOperationalData() {
  await prisma.appUser.updateMany({
    where: {
      linkedUserId: {
        not: null
      }
    },
    data: {
      linkedUserId: null
    }
  });

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "app_sessions",
      "in_app_notifications",
      "notification_preferences",
      "blocks",
      "attendance",
      "evaluations",
      "assignments",
      "waiting_list",
      "session_buildings",
      "sessions",
      "cycles",
      "rooms",
      "floors",
      "buildings",
      "universities",
      "governorates",
      "users",
      "activity_log"
    RESTART IDENTITY CASCADE
  `);
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function main() {
  buildBaseLocations();
  processFinalRoster();

  await resetOperationalData();

  for (const [key, name, nameEn, scope, manualOnly, sortOrder, isSystem] of roleDefinitions) {
    await prisma.assignmentRoleDefinition.upsert({
      where: { key },
      update: { name, nameEn, scope, manualOnly, sortOrder, isSystem, isActive: true },
      create: { key, name, nameEn, scope, manualOnly, sortOrder, isSystem, isActive: true }
    });
  }

  const governorateRows = governorateSeeds.map((seed, index) => ({
    code: seed.code,
    name: seed.nameAr,
    nameEn: seed.nameEn,
    sortOrder: (index + 1) * 10,
    isActive: true,
    notes: "real_est_import_2026"
  }));
  await prisma.governorate.createMany({ data: governorateRows, skipDuplicates: true });
  const governorateIds = new Map(
    (
      await prisma.governorate.findMany({
        select: { id: true, code: true }
      })
    ).map((row) => [row.code ?? "", row.id])
  );

  const universityRows = universitySeeds.map((seed, index) => ({
    governorateId: governorateIds.get(governorateSeeds.find((governorate) => governorate.key === seed.governorateKey)!.code)!,
    code: seed.code,
    name: seed.nameAr,
    nameEn: seed.nameEn,
    sortOrder: (index + 1) * 10,
    isActive: true,
    notes: "real_est_import_2026"
  }));
  await prisma.university.createMany({ data: universityRows, skipDuplicates: true });
  const universityIds = new Map(
    (
      await prisma.university.findMany({
        select: { id: true, code: true }
      })
    ).map((row) => [row.code ?? "", row.id])
  );

  const buildingRows = [...canonicalBuildings.values()].map((building, index) => ({
    universityId: universityIds.get(universitySeeds.find((seed) => seed.key === building.universityKey)!.code)!,
    code: building.code,
    name: building.nameAr,
    nameEn: building.nameEn,
    sortOrder: (index + 1) * 10,
    isActive: true,
    notes: "real_est_import_2026"
  }));
  await prisma.building.createMany({ data: buildingRows, skipDuplicates: true });
  const buildingIds = new Map(
    (
      await prisma.building.findMany({
        select: { id: true, code: true }
      })
    ).map((row) => [row.code ?? "", row.id])
  );

  const floorRows = [...floorSeeds.values()].map((floor, index) => ({
    buildingId: buildingIds.get(canonicalBuildings.get(floor.buildingKey)!.code)!,
    code: slugify(floor.nameEn),
    name: floor.nameAr,
    nameEn: floor.nameEn,
    levelNumber: floor.levelNumber,
    sortOrder: (index + 1) * 10,
    isActive: floor.isActive,
    notes: [...floor.notes].join(", ")
  }));
  for (const batch of chunk(floorRows, 200)) {
    await prisma.floor.createMany({ data: batch, skipDuplicates: true });
  }
  const floorIds = new Map<string, string>();
  const persistedFloors = await prisma.floor.findMany({
    select: { id: true, code: true, building: { select: { code: true } } }
  });
  for (const floor of floorSeeds.values()) {
    const persisted = persistedFloors.find(
      (candidate) =>
        candidate.code === slugify(floor.nameEn) &&
        candidate.building.code === canonicalBuildings.get(floor.buildingKey)!.code
    );
    if (persisted) {
      floorIds.set(floor.key, persisted.id);
    }
  }

  const roomRows = [...roomSeeds.values()].map((room) => ({
    floorId: floorIds.get(room.floorKey)!,
    code: room.lookup || null,
    name: room.name,
    nameEn: room.name,
    roomType: room.roomType,
    supportedExamTypes: [...room.supportedExamTypes],
    capacityMin: room.capacityMin,
    capacityMax: room.capacityMax,
    isActive: room.isActive,
    notes: [...room.notes].join(", ")
  }));
  for (const batch of chunk(roomRows, 200)) {
    await prisma.room.createMany({ data: batch, skipDuplicates: true });
  }
  const roomIds = new Map<string, string>();
  const persistedRooms = await prisma.room.findMany({
    select: { id: true, code: true, name: true, floor: { select: { code: true, building: { select: { code: true } } } } }
  });
  for (const room of roomSeeds.values()) {
    const persisted = persistedRooms.find(
      (candidate) =>
        (candidate.code === room.lookup || candidate.name === room.name) &&
        candidate.floor.code === slugify(floorSeeds.get(room.floorKey)!.nameEn) &&
        candidate.floor.building.code === canonicalBuildings.get(room.buildingKey)!.code
    );
    if (persisted) {
      roomIds.set(room.key, persisted.id);
    }
  }

  const userRows = peopleSeeds.map((person) => ({
    name: person.nameAr || person.nameEn,
    nameEn: person.nameEn || null,
    phone: person.phone,
    nationalId: person.nationalId || null,
    email: person.email || null,
    source: person.source,
    organization: person.organization || null,
    branch: pickFirst(person.building, person.preferredCenter, person.location) || null,
    governorateId: governorateIds.get(resolveGovernorate(person.governorate || person.preferredCenter).code) ?? null,
    averageRating: "0",
    totalSessions: 0,
    blockStatus: BlockStatus.CLEAR,
    preferredLanguage: person.nameAr ? LocaleCode.AR : LocaleCode.EN,
    isActive: true,
    notes: [...person.sourceFiles, ...person.notes].join(", ") || null
  }));
  for (const batch of chunk(userRows, 200)) {
    await prisma.user.createMany({ data: batch, skipDuplicates: true });
  }

  const appUserPasswordHash = await hash(process.env.SEED_APP_USERS_PASSWORD ?? "ChangeMe123!", 12);
  const appUsers = [
    { email: "admin@examops.local", displayName: "ExamOps Admin", role: AppUserRole.SUPER_ADMIN, preferredLanguage: LocaleCode.AR },
    { email: "coordinator@examops.local", displayName: "ExamOps Coordinator", role: AppUserRole.COORDINATOR, preferredLanguage: LocaleCode.AR },
    { email: "dataentry@examops.local", displayName: "ExamOps Data Entry", role: AppUserRole.DATA_ENTRY, preferredLanguage: LocaleCode.EN },
    { email: "senior@examops.local", displayName: "ExamOps Senior", role: AppUserRole.SENIOR, preferredLanguage: LocaleCode.AR },
    { email: "viewer@examops.local", displayName: "ExamOps Viewer", role: AppUserRole.VIEWER, preferredLanguage: LocaleCode.EN }
  ];
  for (const appUser of appUsers) {
    await prisma.appUser.upsert({
      where: { email: appUser.email },
      update: {
        displayName: appUser.displayName,
        role: appUser.role,
        passwordHash: appUserPasswordHash,
        preferredLanguage: appUser.preferredLanguage,
        isActive: true
      },
      create: {
        email: appUser.email,
        displayName: appUser.displayName,
        role: appUser.role,
        passwordHash: appUserPasswordHash,
        preferredLanguage: appUser.preferredLanguage,
        isActive: true
      }
    });
  }
  const persistedUsers = await prisma.user.findMany({
    select: { id: true, email: true, phone: true, nationalId: true, nameEn: true }
  });
  const userIds = new Map<string, string>();
  for (const person of peopleSeeds) {
    const persisted = persistedUsers.find(
      (candidate) =>
        (person.email && candidate.email === person.email) ||
        candidate.phone === person.phone ||
        (person.nationalId && candidate.nationalId === person.nationalId) ||
        (candidate.nameEn && normalizeLookup(candidate.nameEn) === normalizeLookup(person.nameEn))
    );
    if (persisted) {
      userIds.set(person.key, persisted.id);
    }
  }

  const cycle = await prisma.cycle.create({
    data: {
      code: "EST-JAN-2026",
      name: "\u062f\u0648\u0631\u0629 EST \u064a\u0646\u0627\u064a\u0631 2026",
      nameEn: "EST January 2026",
      status: CycleStatus.COMPLETED,
      startDate: new Date("2026-01-30T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
      notes: "Imported from real EST files",
      isActive: true
    }
  });

  const sessions = [
    await prisma.session.create({
      data: {
        cycleId: cycle.id,
        name: "\u062c\u0644\u0633\u0629 EST 1",
        nameEn: "EST 1 Session",
        examType: ExamType.EST1,
        sessionDate: new Date("2026-01-30T00:00:00.000Z"),
        dayIndex: 1,
        startsAt: new Date("2026-01-30T08:00:00.000+02:00"),
        endsAt: new Date("2026-01-30T15:00:00.000+02:00"),
        status: SessionStatus.COMPLETED,
        lockedAt: new Date("2026-01-30T07:00:00.000+02:00"),
        notes: "Imported from real EST files",
        isActive: true
      }
    }),
    await prisma.session.create({
      data: {
        cycleId: cycle.id,
        name: "\u062c\u0644\u0633\u0629 EST 2",
        nameEn: "EST 2 Session",
        examType: ExamType.EST2,
        sessionDate: new Date("2026-01-31T00:00:00.000Z"),
        dayIndex: 2,
        startsAt: new Date("2026-01-31T08:00:00.000+02:00"),
        endsAt: new Date("2026-01-31T15:00:00.000+02:00"),
        status: SessionStatus.COMPLETED,
        lockedAt: new Date("2026-01-31T07:00:00.000+02:00"),
        notes: "Imported from real EST files",
        isActive: true
      }
    })
  ];
  const sessionIds = new Map(sessions.map((session) => [session.examType, session.id]));

  for (const examType of [ExamType.EST1, ExamType.EST2]) {
    const links = [...sessionBuildingKeys.get(examType)!].map((buildingKey) => ({
      sessionId: sessionIds.get(examType)!,
      buildingId: buildingIds.get(canonicalBuildings.get(buildingKey)!.code)!,
      isActive: true,
      notes: "Imported from real EST files"
    }));
    if (links.length) {
      await prisma.sessionBuilding.createMany({ data: links, skipDuplicates: true });
    }
  }

  const roleIds = new Map(
    (
      await prisma.assignmentRoleDefinition.findMany({
        select: { id: true, key: true }
      })
    ).map((row) => [row.key, row.id])
  );

  const assignmentRows = assignmentSeeds
    .map((assignment) => {
      const sessionId = sessionIds.get(assignment.sessionExamType);
      const userId = userIds.get(assignment.userKey);
      const buildingId = buildingIds.get(canonicalBuildings.get(assignment.buildingKey)!.code);
      const roleDefinitionId = roleIds.get(assignment.roleKey);
      if (!sessionId || !userId || !buildingId || !roleDefinitionId) {
        skippedAssignments.push({ serial: assignment.sourceSerial, name: assignment.userKey, reason: "missing_fk" });
        return null;
      }
      return {
        sessionId,
        userId,
        buildingId,
        floorId: assignment.floorKey ? floorIds.get(assignment.floorKey) ?? null : null,
        roomId: assignment.roomKey ? roomIds.get(assignment.roomKey) ?? null : null,
        roleDefinitionId,
        status: AssignmentStatus.COMPLETED,
        assignedMethod: AssignmentMethod.MANUAL,
        isManualOverride: true,
        overrideNote: `real_est_import_serial_${assignment.sourceSerial}`
      };
    })
    .filter(Boolean);
  for (const batch of chunk(assignmentRows, 200)) {
    await prisma.assignment.createMany({ data: batch as any[], skipDuplicates: true });
  }

  const summary = {
    extracted: extracted.stats,
    imported: {
      governorates: await prisma.governorate.count(),
      universities: await prisma.university.count(),
      buildings: await prisma.building.count(),
      floors: await prisma.floor.count(),
      rooms: await prisma.room.count(),
      users: await prisma.user.count(),
      cycles: await prisma.cycle.count(),
      sessions: await prisma.session.count(),
      assignments: await prisma.assignment.count()
    },
    skippedAssignments
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

void main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
