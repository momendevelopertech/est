import { stringifyCsv } from "@/lib/csv";
import { getMessages, type Locale } from "@/lib/i18n";
import { createSpreadsheetXml } from "@/lib/tabular";

import {
  getBuilding,
  getFloor,
  getGovernorate,
  getLocationsTree,
  getUniversity
} from "./service";
import type { LocationExportQuery } from "./validation";

type LocationsTreeRecord = Awaited<ReturnType<typeof getLocationsTree>>[number];

type ExportNode = {
  id: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  isActive: boolean;
  notes: string | null;
};

type ExportBuildingNode = ExportNode & {
  address: string | null;
};

type ExportFloorNode = ExportNode & {
  levelNumber: number | null;
};

type ExportRoomNode = ExportNode & {
  roomType: string;
  supportedExamTypes: string[];
  capacityMin: number;
  capacityMax: number;
};

type FlatLocationRow = {
  governorate: ExportNode | null;
  university: ExportNode | null;
  building: ExportBuildingNode | null;
  floor: ExportFloorNode | null;
  room: ExportRoomNode | null;
};

const locationExportHeaders = [
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
  "roomCapacityMax",
  "governorateStatus",
  "universityStatus",
  "buildingStatus",
  "floorStatus",
  "roomStatus",
  "governorateNotes",
  "universityNotes",
  "buildingNotes",
  "floorNotes",
  "roomNotes"
] as const;

function toStatusLabel(value: boolean | null | undefined) {
  if (value === undefined || value === null) {
    return "";
  }

  return value ? "active" : "inactive";
}

function toCell(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function rowMatchesStatusFilter(
  row: FlatLocationRow,
  status: LocationExportQuery["status"]
) {
  if (status === "all") {
    return true;
  }

  if (status === "active") {
    return true;
  }

  return [row.governorate, row.university, row.building, row.floor, row.room]
    .filter((entity): entity is ExportNode => entity !== null)
    .some((entity) => !entity.isActive);
}

function flattenLocationRows(
  tree: LocationsTreeRecord[],
  query: Pick<
    LocationExportQuery,
    "governorateId" | "universityId" | "buildingId" | "floorId" | "status"
  >
) {
  const rows: FlatLocationRow[] = [];

  for (const governorate of tree) {
    if (query.governorateId && governorate.id !== query.governorateId) {
      continue;
    }

    if (governorate.universities.length === 0) {
      rows.push({
        governorate,
        university: null,
        building: null,
        floor: null,
        room: null
      });
      continue;
    }

    for (const university of governorate.universities) {
      if (query.universityId && university.id !== query.universityId) {
        continue;
      }

      if (university.buildings.length === 0) {
        rows.push({
          governorate,
          university,
          building: null,
          floor: null,
          room: null
        });
        continue;
      }

      for (const building of university.buildings) {
        if (query.buildingId && building.id !== query.buildingId) {
          continue;
        }

        if (building.floors.length === 0) {
          rows.push({
            governorate,
            university,
            building,
            floor: null,
            room: null
          });
          continue;
        }

        for (const floor of building.floors) {
          if (query.floorId && floor.id !== query.floorId) {
            continue;
          }

          if (floor.rooms.length === 0) {
            rows.push({
              governorate,
              university,
              building,
              floor,
              room: null
            });
            continue;
          }

          for (const room of floor.rooms) {
            rows.push({
              governorate,
              university,
              building,
              floor,
              room
            });
          }
        }
      }
    }
  }

  return rows.filter((row) => rowMatchesStatusFilter(row, query.status));
}

function toExportValues(row: FlatLocationRow) {
  return [
    toCell(row.governorate?.name),
    toCell(row.governorate?.nameEn),
    toCell(row.governorate?.code),
    toCell(row.university?.name),
    toCell(row.university?.nameEn),
    toCell(row.university?.code),
    toCell(row.building?.name),
    toCell(row.building?.nameEn),
    toCell(row.building?.code),
    toCell(row.building?.address),
    toCell(row.floor?.name),
    toCell(row.floor?.nameEn),
    toCell(row.floor?.code),
    toCell(row.floor?.levelNumber),
    toCell(row.room?.name),
    toCell(row.room?.nameEn),
    toCell(row.room?.code),
    toCell(row.room?.roomType),
    row.room ? row.room.supportedExamTypes.join("|") : "",
    toCell(row.room?.capacityMin),
    toCell(row.room?.capacityMax),
    toStatusLabel(row.governorate?.isActive),
    toStatusLabel(row.university?.isActive),
    toStatusLabel(row.building?.isActive),
    toStatusLabel(row.floor?.isActive),
    toStatusLabel(row.room?.isActive),
    toCell(row.governorate?.notes),
    toCell(row.university?.notes),
    toCell(row.building?.notes),
    toCell(row.floor?.notes),
    toCell(row.room?.notes)
  ];
}

async function assertScopedFiltersExist(query: LocationExportQuery) {
  if (query.governorateId) {
    await getGovernorate(query.governorateId, {
      includeInactive: true
    });
  }

  if (query.universityId) {
    await getUniversity(query.universityId, {
      includeInactive: true
    });
  }

  if (query.buildingId) {
    await getBuilding(query.buildingId, {
      includeInactive: true
    });
  }

  if (query.floorId) {
    await getFloor(query.floorId, {
      includeInactive: true
    });
  }
}

export async function exportLocations(
  query: LocationExportQuery & {
    locale: Locale;
  }
) {
  await assertScopedFiltersExist(query);

  const tree = await getLocationsTree(query.status !== "active");
  const rows = flattenLocationRows(tree, query).map(toExportValues);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const messages = getMessages(query.locale);

  if (query.format === "excel") {
    return {
      body: createSpreadsheetXml({
        sheetName: messages.nav.locations,
        headerRows: [locationExportHeaders as unknown as string[]],
        rows
      }),
      contentType: "application/vnd.ms-excel; charset=utf-8",
      fileName: `locations-export-${dateStamp}.xls`
    };
  }

  return {
    body: `\uFEFF${stringifyCsv([locationExportHeaders as unknown as string[], ...rows])}`,
    contentType: "text/csv; charset=utf-8",
    fileName: `locations-export-${dateStamp}.csv`
  };
}
