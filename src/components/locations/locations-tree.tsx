"use client";

import { useEffect, useMemo, useState } from "react";

import { TemplateDownloadCard } from "@/components/import-templates/template-download-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyState,
  DataTableHead,
  DataTableHeader,
  DataTableRow
} from "@/components/ui/data-table";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { RefreshIcon } from "@/components/ui/icons";
import { ModalFrame } from "@/components/ui/modal-frame";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHero } from "@/components/ui/page-hero";
import { Textarea } from "@/components/ui/textarea";
import type { Locale, Messages } from "@/lib/i18n";
import {
  getAlternateLocalizedName,
  getLocalizedName
} from "@/lib/i18n/presentation";
import { matchesBilingualSearch } from "@/lib/search/bilingual";

type RoomRecord = {
  id: string;
  floorId: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  roomType: string;
  supportedExamTypes: Array<keyof Messages["locations"]["examTypeLabels"]>;
  capacityMin: number;
  capacityMax: number;
  isActive: boolean;
  notes: string | null;
};

type FloorRecord = {
  id: string;
  buildingId: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  levelNumber: number | null;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
  rooms: RoomRecord[];
};

type BuildingRecord = {
  id: string;
  universityId: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  address: string | null;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
  floors: FloorRecord[];
};

type UniversityRecord = {
  id: string;
  governorateId: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
  buildings: BuildingRecord[];
};

type GovernorateRecord = {
  id: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
  universities: UniversityRecord[];
};

type LocationsResponse = {
  ok: boolean;
  data?: GovernorateRecord[];
  error?: string;
};

type ImportResponse = {
  ok: boolean;
  summary?: {
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
  errors?: Array<{
    row: number;
    error?: string;
    message: string;
  }>;
  sampleCsv?: string;
  columns?: string[];
  error?: string;
  message?: string;
};

type LocationMutationResponse = {
  ok: boolean;
  data?: {
    id: string;
    governorateId?: string;
    universityId?: string;
    buildingId?: string;
    floorId?: string;
  };
  error?: string;
  message?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  } | Record<string, unknown> | null;
};

type LocationsTreeProps = {
  locale: Locale;
  messages: Messages;
};

type TreeStats = {
  governorates: number;
  universities: number;
  buildings: number;
  floors: number;
  rooms: number;
};

type SelectionState = {
  governorateId: string | null;
  universityId: string | null;
  buildingId: string | null;
  floorId: string | null;
};

type HierarchyOption = {
  id: string;
  title: string;
  subtitle: string | null;
  code: string | null;
  count: number;
  isActive: boolean;
};

type LocationEntityType = "governorate" | "university" | "building" | "floor" | "room";
type LocationExportFormat = "csv" | "excel";
type LocationExportStatus = "active" | "inactive" | "all";
type LocationExportScope = "all" | "governorate" | "university" | "building" | "floor";

type LocationFormState = {
  code: string;
  name: string;
  nameEn: string;
  sortOrder: string;
  isActive: boolean;
  notes: string;
  governorateId: string;
  universityId: string;
  buildingId: string;
  floorId: string;
  address: string;
  levelNumber: string;
  roomType: string;
  supportedExamTypes: Array<keyof Messages["locations"]["examTypeLabels"]>;
  capacityMin: string;
  capacityMax: string;
};

const pageSizeOptions = [25, 50, 100];
const selectClassName =
  "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent";

function collectStats(data: GovernorateRecord[]): TreeStats {
  return data.reduce(
    (stats, governorate) => {
      stats.governorates += 1;
      stats.universities += governorate.universities.length;

      for (const university of governorate.universities) {
        stats.buildings += university.buildings.length;

        for (const building of university.buildings) {
          stats.floors += building.floors.length;

          for (const floor of building.floors) {
            stats.rooms += floor.rooms.length;
          }
        }
      }

      return stats;
    },
    {
      governorates: 0,
      universities: 0,
      buildings: 0,
      floors: 0,
      rooms: 0
    }
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function HierarchySkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-72 animate-pulse rounded-3xl border border-border bg-surface-elevated"
        />
      ))}
    </div>
  );
}

function matchesLocationSearch(
  searchTerm: string,
  values: Array<string | null | undefined>
) {
  return matchesBilingualSearch(searchTerm, values);
}

function filterLocations(
  governorates: GovernorateRecord[],
  searchTerm: string
): GovernorateRecord[] {
  const normalized = searchTerm.trim();

  if (!normalized) {
    return governorates;
  }

  return governorates.flatMap((governorate) => {
    const universities = governorate.universities.flatMap((university) => {
      const buildings = university.buildings.flatMap((building) => {
        const floors = building.floors.flatMap((floor) => {
          const rooms = floor.rooms.filter((room) =>
            matchesLocationSearch(normalized, [
              room.name,
              room.nameEn,
              room.code,
              room.roomType,
              room.notes
            ])
          );

          if (
            matchesLocationSearch(normalized, [
              floor.name,
              floor.nameEn,
              floor.code,
              floor.notes,
              floor.levelNumber?.toString()
            ]) ||
            rooms.length > 0
          ) {
            return [{ ...floor, rooms }];
          }

          return [];
        });

        if (
          matchesLocationSearch(normalized, [
            building.name,
            building.nameEn,
            building.code,
            building.address,
            building.notes
          ]) ||
          floors.length > 0
        ) {
          return [{ ...building, floors }];
        }

        return [];
      });

      if (
        matchesLocationSearch(normalized, [
          university.name,
          university.nameEn,
          university.code,
          university.notes
        ]) ||
        buildings.length > 0
      ) {
        return [{ ...university, buildings }];
      }

      return [];
    });

    if (
      matchesLocationSearch(normalized, [
        governorate.name,
        governorate.nameEn,
        governorate.code,
        governorate.notes
      ]) ||
      universities.length > 0
    ) {
      return [{ ...governorate, universities }];
    }

    return [];
  });
}

function normalizeSelection(
  governorates: GovernorateRecord[],
  selection: SelectionState
): SelectionState {
  const governorate =
    governorates.find((record) => record.id === selection.governorateId) ??
    governorates[0] ??
    null;
  const university =
    governorate?.universities.find((record) => record.id === selection.universityId) ??
    governorate?.universities[0] ??
    null;
  const building =
    university?.buildings.find((record) => record.id === selection.buildingId) ??
    university?.buildings[0] ??
    null;
  const floor =
    building?.floors.find((record) => record.id === selection.floorId) ??
    building?.floors[0] ??
    null;

  return {
    governorateId: governorate?.id ?? null,
    universityId: university?.id ?? null,
    buildingId: building?.id ?? null,
    floorId: floor?.id ?? null
  };
}

function formatCapacity(room: RoomRecord) {
  if (room.capacityMin === room.capacityMax) {
    return String(room.capacityMax);
  }

  return `${room.capacityMin}-${room.capacityMax}`;
}

function formatExamTypes(room: RoomRecord, messages: Messages) {
  if (room.supportedExamTypes.length === 0) {
    return "-";
  }

  return room.supportedExamTypes
    .map((examType) => messages.locations.examTypeLabels[examType])
    .join(" / ");
}

function HierarchyPanel({
  title,
  items,
  selectedId,
  onSelect,
  messages
}: {
  title: string;
  items: HierarchyOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  messages: Messages;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {messages.locations.labels.children}: {items.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[26rem] space-y-2 overflow-y-auto">
        {items.length === 0 ? (
          <DataTableEmptyState
            title={messages.locations.searchEmptyTitle}
            description={messages.locations.searchEmptyBody}
            className="px-4 py-6"
          />
        ) : (
          items.map((item) => {
            const isSelected = item.id === selectedId;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full rounded-[22px] border px-4 py-3 text-start transition ${
                  isSelected
                    ? "border-accent bg-accent/10 shadow-[0_18px_36px_-26px_rgba(15,118,110,0.7)]"
                    : "border-border bg-surface-elevated hover:border-border-strong hover:bg-background/70"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isSelected ? "accent" : "default"}>
                    {item.count}
                  </Badge>
                  <Badge>
                    {item.isActive
                      ? messages.locations.labels.active
                      : messages.locations.labels.inactive}
                  </Badge>
                  {item.code ? (
                    <Badge>{`${messages.locations.labels.code}: ${item.code}`}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 font-semibold text-text-primary">{item.title}</p>
                {item.subtitle ? (
                  <p className="mt-1 text-sm text-text-secondary">{item.subtitle}</p>
                ) : null}
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function createInitialLocationForm(
  entityType: LocationEntityType,
  selection: SelectionState
): LocationFormState {
  return {
    code: "",
    name: "",
    nameEn: "",
    sortOrder: "0",
    isActive: true,
    notes: "",
    governorateId: selection.governorateId ?? "",
    universityId: selection.universityId ?? "",
    buildingId: selection.buildingId ?? "",
    floorId: selection.floorId ?? "",
    address: "",
    levelNumber: "",
    roomType: entityType === "room" ? "STANDARD" : "",
    supportedExamTypes: entityType === "room" ? ["EST1"] : [],
    capacityMin: entityType === "room" ? "0" : "",
    capacityMax: entityType === "room" ? "1" : ""
  };
}

function extractApiErrorMessage(
  payload: {
    error?: string;
    message?: string;
    details?:
      | {
          fieldErrors?: Record<string, string[] | undefined>;
          formErrors?: string[];
        }
      | Record<string, unknown>
      | null;
  },
  fallback: string
) {
  if (payload.message) {
    return payload.message;
  }

  const details = payload.details;

  if (
    details &&
    "fieldErrors" in details &&
    details.fieldErrors &&
    typeof details.fieldErrors === "object"
  ) {
    for (const errors of Object.values(details.fieldErrors)) {
      if (Array.isArray(errors) && errors.length > 0) {
        return errors[0] ?? fallback;
      }
    }
  }

  if (
    details &&
    "formErrors" in details &&
    Array.isArray(details.formErrors) &&
    details.formErrors.length > 0
  ) {
    return details.formErrors[0] ?? fallback;
  }

  return payload.error ?? fallback;
}

export function LocationsTree({ locale, messages }: LocationsTreeProps) {
  const copy =
    locale === "ar"
      ? {
          manualAdd: "إضافة يدويًا",
          manualEdit: "تعديل",
          manualDelete: "حذف / تعطيل",
          exportLabel: "تصدير",
          manageTitle: "إدارة الجزء المحدد",
          manageBody:
            "أضف مستوى جديدًا تحت الجزء الحالي أو عدّل البيانات الموجودة بدون الحاجة لرفع شيت كامل كل مرة.",
          templateTitle: "قالب استيراد المواقع",
          templateDescription:
            "حمّل القالب أو العينة من نفس الصفحة، سواء كنت ترفع موقعًا كاملًا أو تضيف دورًا أو غرفة يدويًا.",
          templateButton: "تحميل القالب",
          templateSample: "تحميل عينة",
          templateOpenAll: "كل القوالب",
          saveError: "تعذر حفظ بيانات الموقع.",
          deleteError: "تعذر حذف / تعطيل السجل.",
          exportError: "تعذر تصدير المواقع.",
          deleteConfirm:
            "سيتم تعطيل السجل الحالي. إذا كان لديه أبناء نشطون سيرفض النظام العملية. هل تريد المتابعة؟",
          createTitle: "إضافة سجل جديد",
          editTitle: "تعديل السجل",
          createBody:
            "استخدم الإدخال اليدوي لإضافة محافظة أو جامعة أو مبنى أو دور أو غرفة مباشرة من الشجرة الحالية.",
          submitCreate: "إضافة السجل",
          submitEdit: "حفظ التعديل",
          saving: "جارٍ الحفظ...",
          statusLabel: "الحالة",
          activeOption: "نشط",
          inactiveOption: "غير نشط",
          nameLabel: "الاسم",
          nameEnLabel: "الاسم بالإنجليزية",
          addressLabel: "العنوان",
          sortOrderLabel: "الترتيب",
          notesLabel: "ملاحظات",
          addGovernorate: "إضافة محافظة",
          addUniversity: "إضافة جامعة",
          addBuilding: "إضافة مبنى",
          addFloor: "إضافة دور",
          addRoom: "إضافة غرفة",
          currentSelection: "التحديد الحالي",
          roomActions: "إجراءات",
          noSelection: "اختر جزءًا من الشجرة لبدء الإدارة اليدوية.",
          exportTitle: "تصدير المواقع",
          exportBody:
            "نزّل المواقع كلها أو الجزء المحدد حاليًا من الشجرة بصيغة CSV أو Excel.",
          exportFormat: "صيغة الملف",
          exportStatus: "حالة السجلات",
          exportScope: "نطاق التصدير",
          exportAll: "كل المواقع",
          exportCurrentGovernorate: "المحافظة المحددة",
          exportCurrentUniversity: "الجامعة المحددة",
          exportCurrentBuilding: "المبنى المحدد",
          exportCurrentFloor: "الدور المحدد",
          exportSubmit: "تنزيل الملف",
          exporting: "جارٍ التجهيز..."
        }
      : {
          manualAdd: "Add manually",
          manualEdit: "Edit",
          manualDelete: "Deactivate",
          exportLabel: "Export",
          manageTitle: "Manage current selection",
          manageBody:
            "Add a new child level under the current selection or update existing data without preparing a full spreadsheet every time.",
          templateTitle: "Locations import template",
          templateDescription:
            "Download the template or sample directly from this page, whether you upload a full hierarchy or add one floor or room manually.",
          templateButton: "Download template",
          templateSample: "Download sample",
          templateOpenAll: "All templates",
          saveError: "Could not save the location.",
          deleteError: "Could not deactivate the record.",
          exportError: "Could not export locations.",
          deleteConfirm:
            "The current record will be deactivated. The API will reject the action if active child records still exist. Continue?",
          createTitle: "Create location record",
          editTitle: "Edit location record",
          createBody:
            "Use manual entry to add a governorate, university, building, floor, or room directly from the current hierarchy.",
          submitCreate: "Create record",
          submitEdit: "Save changes",
          saving: "Saving...",
          statusLabel: "Status",
          activeOption: "Active",
          inactiveOption: "Inactive",
          nameLabel: "Name",
          nameEnLabel: "English name",
          addressLabel: "Address",
          sortOrderLabel: "Sort order",
          notesLabel: "Notes",
          addGovernorate: "Add governorate",
          addUniversity: "Add university",
          addBuilding: "Add building",
          addFloor: "Add floor",
          addRoom: "Add room",
          currentSelection: "Current selection",
          roomActions: "Actions",
          noSelection: "Select a hierarchy node to start managing records manually.",
          exportTitle: "Export locations",
          exportBody:
            "Download either the full hierarchy or the currently selected scope as CSV or Excel.",
          exportFormat: "File format",
          exportStatus: "Record status",
          exportScope: "Export scope",
          exportAll: "All locations",
          exportCurrentGovernorate: "Selected governorate",
          exportCurrentUniversity: "Selected university",
          exportCurrentBuilding: "Selected building",
          exportCurrentFloor: "Selected floor",
          exportSubmit: "Download export",
          exporting: "Preparing..."
        };
  const [includeInactive, setIncludeInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roomsPage, setRoomsPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [importSample, setImportSample] = useState("");
  const [governorates, setGovernorates] = useState<GovernorateRecord[]>([]);
  const [stats, setStats] = useState<TreeStats>({
    governorates: 0,
    universities: 0,
    buildings: 0,
    floors: 0,
    rooms: 0
  });
  const [selectedGovernorateId, setSelectedGovernorateId] = useState<string | null>(null);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeEntityType, setActiveEntityType] = useState<LocationEntityType>("room");
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [formState, setFormState] = useState<LocationFormState>(() =>
    createInitialLocationForm("room", {
      governorateId: null,
      universityId: null,
      buildingId: null,
      floorId: null
    })
  );
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<LocationExportFormat>("csv");
  const [exportStatus, setExportStatus] = useState<LocationExportStatus>("active");
  const [exportScope, setExportScope] = useState<LocationExportScope>("all");

  useEffect(() => {
    const controller = new AbortController();

    async function loadLocations() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/locations?includeInactive=${includeInactive ? "true" : "false"}`,
          {
            method: "GET",
            credentials: "same-origin",
            signal: controller.signal,
            headers: {
              Accept: "application/json"
            }
          }
        );

        const payload = (await response.json()) as LocationsResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error ?? "locations_request_failed");
        }

        setGovernorates(payload.data);
        setStats(collectStats(payload.data));
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(loadError);
        setGovernorates([]);
        setStats({
          governorates: 0,
          universities: 0,
          buildings: 0,
          floors: 0,
          rooms: 0
        });
        setError(messages.locations.errorBody);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadLocations();

    return () => {
      controller.abort();
    };
  }, [includeInactive, messages.locations.errorBody, refreshKey]);

  const visibleGovernorates = useMemo(
    () => filterLocations(governorates, searchTerm),
    [governorates, searchTerm]
  );

  const normalizedSelection = useMemo(
    () =>
      normalizeSelection(visibleGovernorates, {
        governorateId: selectedGovernorateId,
        universityId: selectedUniversityId,
        buildingId: selectedBuildingId,
        floorId: selectedFloorId
      }),
    [
      selectedBuildingId,
      selectedFloorId,
      selectedGovernorateId,
      selectedUniversityId,
      visibleGovernorates
    ]
  );

  useEffect(() => {
    if (selectedGovernorateId !== normalizedSelection.governorateId) {
      setSelectedGovernorateId(normalizedSelection.governorateId);
    }
    if (selectedUniversityId !== normalizedSelection.universityId) {
      setSelectedUniversityId(normalizedSelection.universityId);
    }
    if (selectedBuildingId !== normalizedSelection.buildingId) {
      setSelectedBuildingId(normalizedSelection.buildingId);
    }
    if (selectedFloorId !== normalizedSelection.floorId) {
      setSelectedFloorId(normalizedSelection.floorId);
    }
  }, [
    normalizedSelection,
    selectedBuildingId,
    selectedFloorId,
    selectedGovernorateId,
    selectedUniversityId
  ]);

  const selectedGovernorate =
    visibleGovernorates.find(
      (governorate) => governorate.id === normalizedSelection.governorateId
    ) ?? null;
  const visibleUniversities = selectedGovernorate?.universities ?? [];
  const selectedUniversity =
    visibleUniversities.find(
      (university) => university.id === normalizedSelection.universityId
    ) ?? null;
  const visibleBuildings = selectedUniversity?.buildings ?? [];
  const selectedBuilding =
    visibleBuildings.find((building) => building.id === normalizedSelection.buildingId) ??
    null;
  const visibleFloors = selectedBuilding?.floors ?? [];
  const selectedFloor =
    visibleFloors.find((floor) => floor.id === normalizedSelection.floorId) ?? null;
  const selectedRooms = selectedFloor?.rooms ?? [];

  const roomPageCount = Math.max(1, Math.ceil(selectedRooms.length / pageSize));
  const currentRoomPage = Math.min(roomsPage, roomPageCount);
  const visibleRooms = selectedRooms.slice(
    (currentRoomPage - 1) * pageSize,
    currentRoomPage * pageSize
  );

  useEffect(() => {
    setRoomsPage(1);
  }, [pageSize, selectedFloorId, searchTerm]);

  const governorateOptions = visibleGovernorates.map((governorate) => ({
    id: governorate.id,
    title: getLocalizedName(governorate, locale),
    subtitle: getAlternateLocalizedName(governorate, locale),
    code: governorate.code,
    count: governorate.universities.length,
    isActive: governorate.isActive
  }));

  const universityOptions = visibleUniversities.map((university) => ({
    id: university.id,
    title: getLocalizedName(university, locale),
    subtitle: getAlternateLocalizedName(university, locale),
    code: university.code,
    count: university.buildings.length,
    isActive: university.isActive
  }));

  const buildingOptions = visibleBuildings.map((building) => ({
    id: building.id,
    title: getLocalizedName(building, locale),
    subtitle: building.address ?? getAlternateLocalizedName(building, locale),
    code: building.code,
    count: building.floors.length,
    isActive: building.isActive
  }));

  const floorOptions = visibleFloors.map((floor) => ({
    id: floor.id,
    title: getLocalizedName(floor, locale),
    subtitle:
      floor.levelNumber !== null
        ? `${messages.locations.labels.level}: ${floor.levelNumber}`
        : getAlternateLocalizedName(floor, locale),
    code: floor.code,
    count: floor.rooms.length,
    isActive: floor.isActive
  }));

  const selectionTrail = [
    selectedGovernorate,
    selectedUniversity,
    selectedBuilding,
    selectedFloor
  ].filter(
    (
      node
    ): node is GovernorateRecord | UniversityRecord | BuildingRecord | FloorRecord =>
      node !== null
  );

  const statItems: Array<{
    key: keyof TreeStats;
    label: string;
  }> = [
    { key: "governorates", label: messages.locations.kinds.governorate },
    { key: "universities", label: messages.locations.kinds.university },
    { key: "buildings", label: messages.locations.kinds.building },
    { key: "floors", label: messages.locations.kinds.floor },
    { key: "rooms", label: messages.locations.kinds.room }
  ];
  const examTypeOptions = Object.entries(messages.locations.examTypeLabels) as Array<
    [keyof Messages["locations"]["examTypeLabels"], string]
  >;
  const exportScopeOptions: Array<{
    value: LocationExportScope;
    label: string;
    disabled?: boolean;
  }> = [
    { value: "all", label: copy.exportAll },
    {
      value: "governorate",
      label: copy.exportCurrentGovernorate,
      disabled: !selectedGovernorate
    },
    {
      value: "university",
      label: copy.exportCurrentUniversity,
      disabled: !selectedUniversity
    },
    {
      value: "building",
      label: copy.exportCurrentBuilding,
      disabled: !selectedBuilding
    },
    {
      value: "floor",
      label: copy.exportCurrentFloor,
      disabled: !selectedFloor
    }
  ];

  async function openImportModal() {
    setIsImportOpen(true);
    setImportError(null);

    if (importSample) {
      return;
    }

    try {
      const response = await fetch("/api/locations/import", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      const payload = (await response.json()) as ImportResponse;

      if (response.ok && payload.ok && payload.sampleCsv) {
        setImportSample(payload.sampleCsv);
      }
    } catch (sampleError) {
      console.error(sampleError);
    }
  }

  async function handleImportSubmit() {
    if (!selectedFile) {
      setImportError(messages.locations.importFlow.missingFile);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setImportError(messages.locations.importFlow.unsupportedFile);
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/locations/import", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      const payload = (await response.json()) as ImportResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? payload.error ?? "import_failed");
      }

      setImportResult(payload);
      setSelectedFile(null);
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      console.error(submitError);
      setImportError(
        submitError instanceof Error ? submitError.message : messages.locations.errorBody
      );
    } finally {
      setIsImporting(false);
    }
  }

  function openCreateForm(entityType: LocationEntityType) {
    setActionError(null);
    setEditingLocationId(null);
    setActiveEntityType(entityType);
    setFormState(createInitialLocationForm(entityType, normalizedSelection));
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(
    entityType: "governorate",
    record: GovernorateRecord
  ): void;
  function openEditForm(entityType: "university", record: UniversityRecord): void;
  function openEditForm(entityType: "building", record: BuildingRecord): void;
  function openEditForm(entityType: "floor", record: FloorRecord): void;
  function openEditForm(entityType: "room", record: RoomRecord): void;
  function openEditForm(
    entityType: LocationEntityType,
    record: GovernorateRecord | UniversityRecord | BuildingRecord | FloorRecord | RoomRecord
  ) {
    setActionError(null);
    setActiveEntityType(entityType);
    setEditingLocationId(record.id);
    setFormError(null);

    const baseState = createInitialLocationForm(entityType, normalizedSelection);

    if (entityType === "governorate") {
      const governorate = record as GovernorateRecord;

      setFormState({
        ...baseState,
        code: governorate.code ?? "",
        name: governorate.name,
        nameEn: governorate.nameEn ?? "",
        sortOrder: String(governorate.sortOrder),
        isActive: governorate.isActive,
        notes: governorate.notes ?? ""
      });
    } else if (entityType === "university") {
      const university = record as UniversityRecord;

      setFormState({
        ...baseState,
        governorateId: university.governorateId,
        code: university.code ?? "",
        name: university.name,
        nameEn: university.nameEn ?? "",
        sortOrder: String(university.sortOrder),
        isActive: university.isActive,
        notes: university.notes ?? ""
      });
    } else if (entityType === "building") {
      const building = record as BuildingRecord;

      setFormState({
        ...baseState,
        universityId: building.universityId,
        code: building.code ?? "",
        name: building.name,
        nameEn: building.nameEn ?? "",
        sortOrder: String(building.sortOrder),
        isActive: building.isActive,
        notes: building.notes ?? "",
        address: building.address ?? ""
      });
    } else if (entityType === "floor") {
      const floor = record as FloorRecord;

      setFormState({
        ...baseState,
        buildingId: floor.buildingId,
        code: floor.code ?? "",
        name: floor.name,
        nameEn: floor.nameEn ?? "",
        sortOrder: String(floor.sortOrder),
        isActive: floor.isActive,
        notes: floor.notes ?? "",
        levelNumber: floor.levelNumber === null ? "" : String(floor.levelNumber)
      });
    } else {
      const room = record as RoomRecord;

      setFormState({
        ...baseState,
        floorId: room.floorId,
        code: room.code ?? "",
        name: room.name,
        nameEn: room.nameEn ?? "",
        isActive: room.isActive,
        notes: room.notes ?? "",
        roomType: room.roomType,
        supportedExamTypes: room.supportedExamTypes,
        capacityMin: String(room.capacityMin),
        capacityMax: String(room.capacityMax)
      });
    }

    setIsFormOpen(true);
  }

  async function handleSaveLocation() {
    setIsSaving(true);
    setFormError(null);

    const endpoint = `/api/locations/${
      activeEntityType === "governorate"
        ? "governorates"
        : activeEntityType === "university"
          ? "universities"
          : activeEntityType === "building"
            ? "buildings"
            : activeEntityType === "floor"
              ? "floors"
              : "rooms"
    }${editingLocationId ? `/${editingLocationId}` : ""}`;

    const payload =
      activeEntityType === "governorate"
        ? {
            code: formState.code || undefined,
            name: formState.name,
            nameEn: formState.nameEn || undefined,
            sortOrder: Number(formState.sortOrder || "0"),
            isActive: formState.isActive,
            notes: formState.notes || undefined
          }
        : activeEntityType === "university"
          ? {
              governorateId: formState.governorateId,
              code: formState.code || undefined,
              name: formState.name,
              nameEn: formState.nameEn || undefined,
              sortOrder: Number(formState.sortOrder || "0"),
              isActive: formState.isActive,
              notes: formState.notes || undefined
            }
          : activeEntityType === "building"
            ? {
                universityId: formState.universityId,
                code: formState.code || undefined,
                name: formState.name,
                nameEn: formState.nameEn || undefined,
                address: formState.address || undefined,
                sortOrder: Number(formState.sortOrder || "0"),
                isActive: formState.isActive,
                notes: formState.notes || undefined
              }
            : activeEntityType === "floor"
              ? {
                  buildingId: formState.buildingId,
                  code: formState.code || undefined,
                  name: formState.name,
                  nameEn: formState.nameEn || undefined,
                  levelNumber:
                    formState.levelNumber.trim().length > 0
                      ? Number(formState.levelNumber)
                      : undefined,
                  sortOrder: Number(formState.sortOrder || "0"),
                  isActive: formState.isActive,
                  notes: formState.notes || undefined
                }
              : {
                  floorId: formState.floorId,
                  code: formState.code || undefined,
                  name: formState.name,
                  nameEn: formState.nameEn || undefined,
                  roomType: formState.roomType,
                  supportedExamTypes: formState.supportedExamTypes,
                  capacityMin: Number(formState.capacityMin || "0"),
                  capacityMax: Number(formState.capacityMax || "0"),
                  isActive: formState.isActive,
                  notes: formState.notes || undefined
                };

    try {
      const response = await fetch(endpoint, {
        method: editingLocationId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as LocationMutationResponse;

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(extractApiErrorMessage(result, copy.saveError));
      }

      if (activeEntityType === "governorate") {
        setSelectedGovernorateId(result.data.id);
        setSelectedUniversityId(null);
        setSelectedBuildingId(null);
        setSelectedFloorId(null);
      } else if (activeEntityType === "university") {
        setSelectedGovernorateId(result.data.governorateId ?? normalizedSelection.governorateId);
        setSelectedUniversityId(result.data.id);
        setSelectedBuildingId(null);
        setSelectedFloorId(null);
      } else if (activeEntityType === "building") {
        setSelectedUniversityId(result.data.universityId ?? normalizedSelection.universityId);
        setSelectedBuildingId(result.data.id);
        setSelectedFloorId(null);
      } else if (activeEntityType === "floor") {
        setSelectedBuildingId(result.data.buildingId ?? normalizedSelection.buildingId);
        setSelectedFloorId(result.data.id);
      } else {
        setSelectedFloorId(result.data.floorId ?? normalizedSelection.floorId);
      }

      setIsFormOpen(false);
      setEditingLocationId(null);
      setRefreshKey((current) => current + 1);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : copy.saveError
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivateLocation(
    entityType: LocationEntityType,
    locationId: string
  ) {
    const shouldContinue = window.confirm(copy.deleteConfirm);

    if (!shouldContinue) {
      return;
    }

    try {
      const endpoint = `/api/locations/${
        entityType === "governorate"
          ? "governorates"
          : entityType === "university"
            ? "universities"
            : entityType === "building"
              ? "buildings"
              : entityType === "floor"
                ? "floors"
                : "rooms"
      }/${locationId}`;
      const response = await fetch(endpoint, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const result = (await response.json()) as LocationMutationResponse;

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(extractApiErrorMessage(result, copy.deleteError));
      }

      if (entityType === "governorate" && selectedGovernorateId === locationId) {
        setSelectedGovernorateId(null);
        setSelectedUniversityId(null);
        setSelectedBuildingId(null);
        setSelectedFloorId(null);
      } else if (entityType === "university" && selectedUniversityId === locationId) {
        setSelectedUniversityId(null);
        setSelectedBuildingId(null);
        setSelectedFloorId(null);
      } else if (entityType === "building" && selectedBuildingId === locationId) {
        setSelectedBuildingId(null);
        setSelectedFloorId(null);
      } else if (entityType === "floor" && selectedFloorId === locationId) {
        setSelectedFloorId(null);
      }

      setIsFormOpen(false);
      setEditingLocationId(null);
      setActionError(null);
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : copy.deleteError;

      if (isFormOpen) {
        setFormError(message);
        return;
      }

      setActionError(message);
    }
  }

  async function handleExportLocations() {
    setIsExporting(true);
    setExportError(null);

    try {
      const params = new URLSearchParams();
      params.set("format", exportFormat);
      params.set("status", exportStatus);
      params.set("locale", locale);

      if (exportScope === "governorate" && selectedGovernorate) {
        params.set("governorateId", selectedGovernorate.id);
      }

      if (exportScope === "university" && selectedUniversity) {
        params.set("universityId", selectedUniversity.id);
      }

      if (exportScope === "building" && selectedBuilding) {
        params.set("buildingId", selectedBuilding.id);
      }

      if (exportScope === "floor" && selectedFloor) {
        params.set("floorId", selectedFloor.id);
      }

      const response = await fetch(`/api/locations/export?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin"
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
          details?: Record<string, unknown> | null;
        };
        throw new Error(extractApiErrorMessage(payload, copy.exportError));
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("content-disposition");
      const fileNameMatch = disposition?.match(/filename=\"([^\"]+)\"/);

      anchor.href = downloadUrl;
      anchor.download =
        fileNameMatch?.[1] ??
        (exportFormat === "excel" ? "locations-export.xls" : "locations-export.csv");
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setIsExportOpen(false);
    } catch (downloadError) {
      setExportError(
        downloadError instanceof Error ? downloadError.message : copy.exportError
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.nav.locations }
        ]}
        title={messages.locations.title}
        description={messages.locations.subtitle}
        body={
          <div className="space-y-4">
            <p className="max-w-3xl text-sm leading-7 text-text-secondary">
              {messages.locations.description}
            </p>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="locations-search"
                >
                  {messages.locations.searchLabel}
                </label>
                <Input
                  id="locations-search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={messages.locations.searchPlaceholder}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => openCreateForm("governorate")}>
                  {copy.manualAdd}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void openImportModal()}>
                  {messages.locations.import}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setExportScope(
                      selectedFloor
                        ? "floor"
                        : selectedBuilding
                          ? "building"
                          : selectedUniversity
                            ? "university"
                            : selectedGovernorate
                              ? "governorate"
                              : "all"
                    );
                    setIsExportOpen(true);
                  }}
                >
                  {copy.exportLabel}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIncludeInactive((current) => !current)}
                >
                  {includeInactive
                    ? messages.locations.showActiveOnly
                    : messages.locations.showInactive}
                </Button>
                <IconButton
                  variant="secondary"
                  size="sm"
                  icon={<RefreshIcon />}
                  label={messages.locations.reload}
                  onClick={() => setRefreshKey((current) => current + 1)}
                />
              </div>
            </div>
          </div>
        }
      />

      <TemplateDownloadCard
        locale={locale}
        templateKey="locations"
        title={copy.templateTitle}
        description={copy.templateDescription}
        templateLabel={copy.templateButton}
        sampleLabel={copy.templateSample}
        openAllLabel={copy.templateOpenAll}
      />

      <Card>
        <CardHeader>
          <CardTitle>{messages.locations.statsTitle}</CardTitle>
          <CardDescription>{messages.locations.statsBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {statItems.map((item) => (
            <StatCard key={item.key} label={item.label} value={stats[item.key]} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>{messages.locations.title}</CardTitle>
            <CardDescription>{messages.locations.description}</CardDescription>
          </div>

          {selectionTrail.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectionTrail.map((node) => (
                <Badge key={node.id} variant="accent">
                  {getLocalizedName(node, locale)}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? <HierarchySkeleton /> : null}

          {!isLoading && error ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-5 py-5">
              <h3 className="text-lg font-semibold text-text-primary">
                {messages.locations.errorTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">{error}</p>
              <div className="mt-4">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setRefreshKey((current) => current + 1)}
                >
                  {messages.locations.retry}
                </Button>
              </div>
            </div>
          ) : null}

          {!isLoading && !error && governorates.length === 0 ? (
            <DataTableEmptyState
              title={messages.locations.emptyTitle}
              description={messages.locations.emptyBody}
            />
          ) : null}

          {!isLoading && !error && governorates.length > 0 && visibleGovernorates.length === 0 ? (
            <DataTableEmptyState
              title={messages.locations.searchEmptyTitle}
              description={messages.locations.searchEmptyBody}
            />
          ) : null}

          {!isLoading && !error && visibleGovernorates.length > 0 ? (
            <>
              <div className="grid gap-4 xl:grid-cols-4">
                <HierarchyPanel
                  title={messages.locations.kinds.governorate}
                  items={governorateOptions}
                  selectedId={normalizedSelection.governorateId}
                  onSelect={(id) => {
                    setSelectedGovernorateId(id);
                    setSelectedUniversityId(null);
                    setSelectedBuildingId(null);
                    setSelectedFloorId(null);
                  }}
                  messages={messages}
                />

                <HierarchyPanel
                  title={messages.locations.kinds.university}
                  items={universityOptions}
                  selectedId={normalizedSelection.universityId}
                  onSelect={(id) => {
                    setSelectedUniversityId(id);
                    setSelectedBuildingId(null);
                    setSelectedFloorId(null);
                  }}
                  messages={messages}
                />

                <HierarchyPanel
                  title={messages.locations.kinds.building}
                  items={buildingOptions}
                  selectedId={normalizedSelection.buildingId}
                  onSelect={(id) => {
                    setSelectedBuildingId(id);
                    setSelectedFloorId(null);
                  }}
                  messages={messages}
                />

                <HierarchyPanel
                  title={messages.locations.kinds.floor}
                  items={floorOptions}
                  selectedId={normalizedSelection.floorId}
                  onSelect={(id) => setSelectedFloorId(id)}
                  messages={messages}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{copy.manageTitle}</CardTitle>
                  <CardDescription>{copy.manageBody}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectionTrail.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <Badge>{copy.currentSelection}</Badge>
                      {selectionTrail.map((node) => (
                        <Badge key={node.id} variant="accent">
                          {getLocalizedName(node, locale)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">{copy.noSelection}</p>
                  )}

                  {actionError ? (
                    <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
                      {actionError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" size="sm" onClick={() => openCreateForm("governorate")}>
                      {copy.addGovernorate}
                    </Button>

                    {selectedGovernorate ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openCreateForm("university")}>
                          {copy.addUniversity}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openEditForm("governorate", selectedGovernorate)}>
                          {copy.manualEdit} {messages.locations.kinds.governorate}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => void handleDeactivateLocation("governorate", selectedGovernorate.id)}>
                          {copy.manualDelete} {messages.locations.kinds.governorate}
                        </Button>
                      </>
                    ) : null}

                    {selectedUniversity ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openCreateForm("building")}>
                          {copy.addBuilding}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openEditForm("university", selectedUniversity)}>
                          {copy.manualEdit} {messages.locations.kinds.university}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => void handleDeactivateLocation("university", selectedUniversity.id)}>
                          {copy.manualDelete} {messages.locations.kinds.university}
                        </Button>
                      </>
                    ) : null}

                    {selectedBuilding ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openCreateForm("floor")}>
                          {copy.addFloor}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openEditForm("building", selectedBuilding)}>
                          {copy.manualEdit} {messages.locations.kinds.building}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => void handleDeactivateLocation("building", selectedBuilding.id)}>
                          {copy.manualDelete} {messages.locations.kinds.building}
                        </Button>
                      </>
                    ) : null}

                    {selectedFloor ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openCreateForm("room")}>
                          {copy.addRoom}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openEditForm("floor", selectedFloor)}>
                          {copy.manualEdit} {messages.locations.kinds.floor}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => void handleDeactivateLocation("floor", selectedFloor.id)}>
                          {copy.manualDelete} {messages.locations.kinds.floor}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-[24px] border border-border bg-surface-elevated">
                <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {messages.locations.kinds.room}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {selectedFloor
                        ? getLocalizedName(selectedFloor, locale)
                        : messages.locations.searchEmptyBody}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedFloor ? (
                      <Button variant="secondary" size="sm" onClick={() => openCreateForm("room")}>
                        {copy.addRoom}
                      </Button>
                    ) : null}
                    <span className="text-sm text-text-secondary">
                      {messages.locations.labels.children}: {selectedRooms.length}
                    </span>
                    <select
                      value={String(pageSize)}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="h-9 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary outline-none"
                    >
                      {pageSizeOptions.map((sizeOption) => (
                        <option key={sizeOption} value={String(sizeOption)}>
                          {sizeOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedFloor && selectedRooms.length > 0 ? (
                  <>
                    <DataTable>
                      <DataTableHeader>
                        <tr>
                          <DataTableHead>{messages.locations.kinds.room}</DataTableHead>
                          <DataTableHead>{messages.locations.labels.code}</DataTableHead>
                          <DataTableHead>{messages.locations.labels.roomType}</DataTableHead>
                          <DataTableHead>{messages.locations.labels.examTypes}</DataTableHead>
                          <DataTableHead>{messages.locations.labels.capacity}</DataTableHead>
                          <DataTableHead>{copy.roomActions}</DataTableHead>
                        </tr>
                      </DataTableHeader>
                      <DataTableBody>
                        {visibleRooms.map((room) => (
                          <DataTableRow key={room.id}>
                            <DataTableCell>
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <Badge>
                                    {room.isActive
                                      ? messages.locations.labels.active
                                      : messages.locations.labels.inactive}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="font-semibold text-text-primary">
                                    {getLocalizedName(room, locale)}
                                  </p>
                                  {getAlternateLocalizedName(room, locale) ? (
                                    <p className="text-xs text-text-secondary">
                                      {getAlternateLocalizedName(room, locale)}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </DataTableCell>
                            <DataTableCell>{room.code ?? "-"}</DataTableCell>
                            <DataTableCell>{room.roomType}</DataTableCell>
                            <DataTableCell>{formatExamTypes(room, messages)}</DataTableCell>
                            <DataTableCell>{formatCapacity(room)}</DataTableCell>
                            <DataTableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openEditForm("room", room)}
                                >
                                  {copy.manualEdit}
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() =>
                                    void handleDeactivateLocation("room", room.id)
                                  }
                                >
                                  {copy.manualDelete}
                                </Button>
                              </div>
                            </DataTableCell>
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>

                    <div className="border-t border-border px-5 py-4">
                      <PaginationControls
                        page={currentRoomPage}
                        pageCount={roomPageCount}
                        total={selectedRooms.length}
                        hasPreviousPage={currentRoomPage > 1}
                        hasNextPage={currentRoomPage < roomPageCount}
                        summaryLabel={messages.cycles.pagination.summary
                          .replace("{page}", String(currentRoomPage))
                          .replace("{pageCount}", String(roomPageCount))}
                        totalLabel={`${messages.locations.kinds.room}: ${selectedRooms.length}`}
                        previousLabel={messages.cycles.pagination.previous}
                        nextLabel={messages.cycles.pagination.next}
                        onPrevious={() =>
                          setRoomsPage((current) => Math.max(1, current - 1))
                        }
                        onNext={() =>
                          setRoomsPage((current) =>
                            Math.min(roomPageCount, current + 1)
                          )
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="p-5">
                    <DataTableEmptyState
                      title={messages.locations.emptyTitle}
                      description={messages.locations.emptyBody}
                    />
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {isFormOpen ? (
        <ModalFrame
          title={editingLocationId ? copy.editTitle : copy.createTitle}
          description={copy.createBody}
          closeLabel={messages.locations.importFlow.close}
          onClose={() => {
            setIsFormOpen(false);
            setEditingLocationId(null);
            setFormError(null);
            setFormState(createInitialLocationForm(activeEntityType, normalizedSelection));
          }}
          className="max-w-5xl"
          bodyClassName="space-y-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {(activeEntityType === "university" ||
              activeEntityType === "building" ||
              activeEntityType === "floor" ||
              activeEntityType === "room") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="location-parent-governorate">
                  {messages.locations.kinds.governorate}
                </label>
                <select
                  id="location-parent-governorate"
                  value={formState.governorateId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      governorateId: event.target.value
                    }))
                  }
                  className={selectClassName}
                  disabled={activeEntityType !== "university"}
                >
                  <option value="">{messages.locations.kinds.governorate}</option>
                  {visibleGovernorates.map((governorate) => (
                    <option key={governorate.id} value={governorate.id}>
                      {getLocalizedName(governorate, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(activeEntityType === "building" ||
              activeEntityType === "floor" ||
              activeEntityType === "room") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="location-parent-university">
                  {messages.locations.kinds.university}
                </label>
                <select
                  id="location-parent-university"
                  value={formState.universityId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      universityId: event.target.value
                    }))
                  }
                  className={selectClassName}
                  disabled={activeEntityType !== "building"}
                >
                  <option value="">{messages.locations.kinds.university}</option>
                  {visibleUniversities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {getLocalizedName(university, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(activeEntityType === "floor" || activeEntityType === "room") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="location-parent-building">
                  {messages.locations.kinds.building}
                </label>
                <select
                  id="location-parent-building"
                  value={formState.buildingId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      buildingId: event.target.value
                    }))
                  }
                  className={selectClassName}
                  disabled={activeEntityType !== "floor"}
                >
                  <option value="">{messages.locations.kinds.building}</option>
                  {visibleBuildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {getLocalizedName(building, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeEntityType === "room" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="location-parent-floor">
                  {messages.locations.kinds.floor}
                </label>
                <select
                  id="location-parent-floor"
                  value={formState.floorId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      floorId: event.target.value
                    }))
                  }
                  className={selectClassName}
                >
                  <option value="">{messages.locations.kinds.floor}</option>
                  {visibleFloors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {getLocalizedName(floor, locale)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="location-form-name">
                {copy.nameLabel}
              </label>
              <Input
                id="location-form-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="location-form-name-en">
                {copy.nameEnLabel}
              </label>
              <Input
                id="location-form-name-en"
                value={formState.nameEn}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, nameEn: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="location-form-code">
                {messages.locations.labels.code}
              </label>
              <Input
                id="location-form-code"
                value={formState.code}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, code: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="location-form-sort-order">
                {copy.sortOrderLabel}
              </label>
              <Input
                id="location-form-sort-order"
                type="number"
                min="0"
                value={formState.sortOrder}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    sortOrder: event.target.value
                  }))
                }
              />
            </div>

            {activeEntityType === "building" ? (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="location-form-address">
                  {copy.addressLabel}
                </label>
                <Input
                  id="location-form-address"
                  value={formState.address}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      address: event.target.value
                    }))
                  }
                />
              </div>
            ) : null}

            {activeEntityType === "floor" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="location-form-level">
                  {messages.locations.labels.level}
                </label>
                <Input
                  id="location-form-level"
                  type="number"
                  value={formState.levelNumber}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      levelNumber: event.target.value
                    }))
                  }
                />
              </div>
            ) : null}

            {activeEntityType === "room" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="location-form-room-type">
                    {messages.locations.labels.roomType}
                  </label>
                  <Input
                    id="location-form-room-type"
                    value={formState.roomType}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        roomType: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="location-form-capacity-min">
                    {messages.locations.labels.capacity}
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      id="location-form-capacity-min"
                      type="number"
                      min="0"
                      value={formState.capacityMin}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          capacityMin: event.target.value
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min="1"
                      value={formState.capacityMax}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          capacityMax: event.target.value
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-text-primary">
                    {messages.locations.labels.examTypes}
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {examTypeOptions.map(([examType, label]) => {
                      const checked = formState.supportedExamTypes.includes(examType);

                      return (
                        <label
                          key={examType}
                          className="flex items-center gap-2 rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                supportedExamTypes: event.target.checked
                                  ? [...current.supportedExamTypes, examType]
                                  : current.supportedExamTypes.filter(
                                      (value) => value !== examType
                                    )
                              }))
                            }
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="location-form-status">
                {copy.statusLabel}
              </label>
              <select
                id="location-form-status"
                value={formState.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    isActive: event.target.value === "active"
                  }))
                }
                className={selectClassName}
              >
                <option value="active">{copy.activeOption}</option>
                <option value="inactive">{copy.inactiveOption}</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="location-form-notes">
                {copy.notesLabel}
              </label>
              <Textarea
                id="location-form-notes"
                value={formState.notes}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </div>
          </div>

          {formError ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3">
            <div>
              {editingLocationId ? (
                <Button
                  variant="danger"
                  onClick={() =>
                    void handleDeactivateLocation(activeEntityType, editingLocationId)
                  }
                >
                  {copy.manualDelete}
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingLocationId(null);
                  setFormError(null);
                }}
              >
                {messages.locations.importFlow.cancel}
              </Button>
              <Button onClick={() => void handleSaveLocation()} disabled={isSaving}>
                {isSaving
                  ? copy.saving
                  : editingLocationId
                    ? copy.submitEdit
                    : copy.submitCreate}
              </Button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {isExportOpen ? (
        <ModalFrame
          title={copy.exportTitle}
          description={copy.exportBody}
          closeLabel={messages.locations.importFlow.close}
          onClose={() => {
            setIsExportOpen(false);
            setExportError(null);
          }}
          className="max-w-3xl"
          bodyClassName="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="locations-export-format">
                {copy.exportFormat}
              </label>
              <select
                id="locations-export-format"
                value={exportFormat}
                onChange={(event) =>
                  setExportFormat(event.target.value as LocationExportFormat)
                }
                className={selectClassName}
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="locations-export-status">
                {copy.exportStatus}
              </label>
              <select
                id="locations-export-status"
                value={exportStatus}
                onChange={(event) =>
                  setExportStatus(event.target.value as LocationExportStatus)
                }
                className={selectClassName}
              >
                <option value="active">{copy.activeOption}</option>
                <option value="inactive">{copy.inactiveOption}</option>
                <option value="all">{locale === "ar" ? "الكل" : "All"}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="locations-export-scope">
              {copy.exportScope}
            </label>
            <select
              id="locations-export-scope"
              value={exportScope}
              onChange={(event) =>
                setExportScope(event.target.value as LocationExportScope)
              }
              className={selectClassName}
            >
              {exportScopeOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {exportError ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
              {exportError}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsExportOpen(false);
                setExportError(null);
              }}
            >
              {messages.locations.importFlow.cancel}
            </Button>
            <Button onClick={() => void handleExportLocations()} disabled={isExporting}>
              {isExporting ? copy.exporting : copy.exportSubmit}
            </Button>
          </div>
        </ModalFrame>
      ) : null}

      {isImportOpen ? (
        <ModalFrame
          title={messages.locations.importFlow.title}
          description={messages.locations.importFlow.subtitle}
          closeLabel={messages.locations.importFlow.close}
          onClose={() => {
            setIsImportOpen(false);
            setImportError(null);
          }}
          className="max-w-5xl"
          bodyClassName="space-y-6"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="locations-import-file">
              {messages.locations.importFlow.fileLabel}
            </label>
            <Input
              id="locations-import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setImportError(null);
              }}
            />
          </div>

          {importError ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
              {importError}
            </div>
          ) : null}

          <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
            <p className="text-sm font-medium text-text-primary">
              {messages.locations.importFlow.sampleTitle}
            </p>
            <p className="mt-2 text-sm leading-7 text-text-secondary">
              {messages.locations.importFlow.sampleBody}
            </p>
            {importSample ? (
              <pre className="mt-4 overflow-x-auto rounded-2xl bg-background px-4 py-4 text-xs leading-6 text-text-secondary">
                {importSample}
              </pre>
            ) : null}
          </div>

          {importResult?.summary ? (
            <div className="space-y-4 rounded-3xl border border-border bg-surface-elevated px-4 py-4">
              <p className="text-sm font-medium text-text-primary">
                {messages.locations.importFlow.resultTitle}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label={messages.locations.importFlow.total}
                  value={importResult.summary.total}
                />
                <StatCard
                  label={messages.locations.importFlow.success}
                  value={importResult.summary.success}
                />
                <StatCard
                  label={messages.locations.importFlow.failed}
                  value={importResult.summary.failed}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                  label={messages.locations.kinds.governorate}
                  value={importResult.summary.created.governorates}
                />
                <StatCard
                  label={messages.locations.kinds.university}
                  value={importResult.summary.created.universities}
                />
                <StatCard
                  label={messages.locations.kinds.building}
                  value={importResult.summary.created.buildings}
                />
                <StatCard
                  label={messages.locations.kinds.floor}
                  value={importResult.summary.created.floors}
                />
                <StatCard
                  label={messages.locations.kinds.room}
                  value={importResult.summary.created.rooms}
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-text-primary">
                  {messages.locations.importFlow.errorsTitle}
                </p>
                {importResult.errors && importResult.errors.length > 0 ? (
                  <div className="space-y-2">
                    {importResult.errors.map((rowError) => (
                      <div
                        key={`${rowError.row}-${rowError.error ?? rowError.message}`}
                        className="rounded-2xl border border-danger/30 bg-background px-4 py-3 text-sm text-text-secondary"
                      >
                        <span className="font-medium text-text-primary">
                          {messages.locations.importFlow.row} {rowError.row}:
                        </span>{" "}
                        {rowError.error ? (
                          <span className="font-medium text-danger">
                            [{rowError.error}]{" "}
                          </span>
                        ) : null}
                        {rowError.message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    {messages.locations.importFlow.noErrors}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                setImportError(null);
                setImportResult(null);
                setIsImportOpen(false);
              }}
            >
              {messages.locations.importFlow.cancel}
            </Button>
            <Button size="sm" onClick={() => void handleImportSubmit()} disabled={isImporting}>
              {isImporting
                ? messages.locations.importFlow.submitting
                : messages.locations.importFlow.submit}
            </Button>
          </div>
        </ModalFrame>
      ) : null}
    </div>
  );
}
