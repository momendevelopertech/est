"use client";

import { useEffect, useMemo, useState } from "react";

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

const pageSizeOptions = [25, 50, 100];

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

export function LocationsTree({ locale, messages }: LocationsTreeProps) {
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
                <Button variant="secondary" size="sm" onClick={() => void openImportModal()}>
                  {messages.locations.import}
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
