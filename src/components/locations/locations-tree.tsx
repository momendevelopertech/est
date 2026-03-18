"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { Locale, Messages } from "@/lib/i18n";

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

type TreeNodeKind = keyof Messages["locations"]["kinds"];

type TreeNode = {
  id: string;
  kind: TreeNodeKind;
  name: string;
  nameEn: string | null;
  code: string | null;
  isActive: boolean;
  meta: {
    levelNumber?: number | null;
    roomType?: string;
    supportedExamTypes?: Array<keyof Messages["locations"]["examTypeLabels"]>;
    capacityMin?: number;
    capacityMax?: number;
  };
  children: TreeNode[];
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

function getNodeLabel(node: Pick<TreeNode, "name" | "nameEn">, locale: Locale) {
  if (locale === "ar") {
    return node.name;
  }

  return node.nameEn ?? node.name;
}

function createTreeNodes(data: GovernorateRecord[]): TreeNode[] {
  return data.map((governorate) => ({
    id: governorate.id,
    kind: "governorate",
    name: governorate.name,
    nameEn: governorate.nameEn,
    code: governorate.code,
    isActive: governorate.isActive,
    meta: {},
    children: governorate.universities.map((university) => ({
      id: university.id,
      kind: "university",
      name: university.name,
      nameEn: university.nameEn,
      code: university.code,
      isActive: university.isActive,
      meta: {},
      children: university.buildings.map((building) => ({
        id: building.id,
        kind: "building",
        name: building.name,
        nameEn: building.nameEn,
        code: building.code,
        isActive: building.isActive,
        meta: {},
        children: building.floors.map((floor) => ({
          id: floor.id,
          kind: "floor",
          name: floor.name,
          nameEn: floor.nameEn,
          code: floor.code,
          isActive: floor.isActive,
          meta: {
            levelNumber: floor.levelNumber
          },
          children: floor.rooms.map((room) => ({
            id: room.id,
            kind: "room",
            name: room.name,
            nameEn: room.nameEn,
            code: room.code,
            isActive: room.isActive,
            meta: {
              roomType: room.roomType,
              supportedExamTypes: room.supportedExamTypes,
              capacityMin: room.capacityMin,
              capacityMax: room.capacityMax
            },
            children: []
          }))
        }))
      }))
    }))
  }));
}

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

function createInitialExpandedState(nodes: TreeNode[]) {
  return nodes.reduce<Record<string, boolean>>((state, node) => {
    state[node.id] = true;
    return state;
  }, {});
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

function TreeSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-3xl border border-border bg-surface-elevated"
        />
      ))}
    </div>
  );
}

function TreeNodeCard({
  locale,
  messages,
  node,
  depth,
  expanded,
  onToggle
}: {
  locale: Locale;
  messages: Messages;
  node: TreeNode;
  depth: number;
  expanded: Record<string, boolean>;
  onToggle: (nodeId: string) => void;
}) {
  const label = getNodeLabel(node, locale);
  const hasChildren = node.children.length > 0;
  const isOpen = expanded[node.id] ?? false;
  const examTypeLabels = node.meta.supportedExamTypes?.map(
    (examType) => messages.locations.examTypeLabels[examType]
  );

  return (
    <div className="space-y-3">
      <Card
        className="panel"
        style={{
          marginInlineStart: `${depth * 12}px`
        }}
      >
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{messages.locations.kinds[node.kind]}</Badge>
              <Badge>
                {node.isActive
                  ? messages.locations.labels.active
                  : messages.locations.labels.inactive}
              </Badge>
              {node.code ? (
                <Badge>{`${messages.locations.labels.code}: ${node.code}`}</Badge>
              ) : null}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text-primary">{label}</h3>
              <p className="mt-1 text-sm text-text-secondary">
                {messages.locations.labels.children}: {node.children.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
              {node.kind === "floor" && node.meta.levelNumber !== undefined ? (
                <span>
                  {messages.locations.labels.level}: {node.meta.levelNumber ?? "-"}
                </span>
              ) : null}
              {node.kind === "room" && node.meta.roomType ? (
                <span>
                  {messages.locations.labels.roomType}: {node.meta.roomType}
                </span>
              ) : null}
              {node.kind === "room" &&
              node.meta.capacityMin !== undefined &&
              node.meta.capacityMax !== undefined ? (
                <span>
                  {messages.locations.labels.capacity}: {node.meta.capacityMin}-
                  {node.meta.capacityMax}
                </span>
              ) : null}
              {node.kind === "room" && examTypeLabels?.length ? (
                <span>
                  {messages.locations.labels.examTypes}: {examTypeLabels.join(" / ")}
                </span>
              ) : null}
            </div>
          </div>

          {hasChildren ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onToggle(node.id)}
              aria-expanded={isOpen}
            >
              {isOpen ? "-" : "+"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {hasChildren && isOpen ? (
        <div className="space-y-3">
          {node.children.map((child) => (
            <TreeNodeCard
              key={child.id}
              locale={locale}
              messages={messages}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LocationsTree({ locale, messages }: LocationsTreeProps) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [stats, setStats] = useState<TreeStats>({
    governorates: 0,
    universities: 0,
    buildings: 0,
    floors: 0,
    rooms: 0
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

        const nextNodes = createTreeNodes(payload.data);
        setNodes(nextNodes);
        setStats(collectStats(payload.data));
        setExpanded(createInitialExpandedState(nextNodes));
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(loadError);
        setNodes([]);
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

  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{messages.nav.locations}</Badge>
          </div>
          <CardTitle className="text-3xl">{messages.locations.title}</CardTitle>
          <CardDescription className="text-base">
            {messages.locations.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-sm leading-7 text-text-secondary">
            {messages.locations.description}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIncludeInactive((current) => !current)}
            >
              {includeInactive
                ? messages.locations.showActiveOnly
                : messages.locations.showInactive}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              {messages.locations.reload}
            </Button>
          </div>
        </CardContent>
      </Card>

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
        <CardHeader>
          <CardTitle>{messages.locations.title}</CardTitle>
          <CardDescription>{messages.locations.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? <TreeSkeleton /> : null}

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

          {!isLoading && !error && nodes.length === 0 ? (
            <div className="rounded-3xl border border-border bg-surface-elevated px-5 py-5">
              <h3 className="text-lg font-semibold text-text-primary">
                {messages.locations.emptyTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                {messages.locations.emptyBody}
              </p>
            </div>
          ) : null}

          {!isLoading && !error && nodes.length > 0 ? (
            <div className="space-y-4">
              {nodes.map((node) => (
                <TreeNodeCard
                  key={node.id}
                  locale={locale}
                  messages={messages}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={(nodeId) =>
                    setExpanded((current) => ({
                      ...current,
                      [nodeId]: !current[nodeId]
                    }))
                  }
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
