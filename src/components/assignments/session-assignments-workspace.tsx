"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Locale, Messages } from "@/lib/i18n";
import { getLocalizedName } from "@/lib/i18n/presentation";

type ExamType = "EST1" | "EST2" | "EST_ASSN";
type RoleScopeValue = "BUILDING" | "FLOOR" | "ROOM";
type ApiPayload<T> = { ok: boolean; data?: T; error?: string; message?: string };

type SessionSummary = {
  id: string;
  name?: string;
  nameEn?: string | null;
  examType: ExamType;
  status: string;
  derivedStatus: string;
  isActive?: boolean;
  buildings: Array<{ id: string; name: string; nameEn: string | null }>;
};

type AssignmentRecord = {
  id: string;
  buildingId: string;
  floorId: string | null;
  roomId: string | null;
  status: "DRAFT" | "CONFIRMED" | "LOCKED" | "CANCELLED" | "COMPLETED";
  assignedMethod: "AUTO" | "MANUAL";
  assignedAt: string;
  overrideNote: string | null;
  user: { id: string; name: string; nameEn: string | null };
  building: { id: string; name: string; nameEn: string | null };
  floor: { id: string; name: string; nameEn: string | null } | null;
  room: { id: string; name: string; nameEn: string | null } | null;
  roleDefinition: {
    id: string;
    name: string;
    nameEn: string | null;
    scope: RoleScopeValue;
    manualOnly: boolean;
  };
};

type RoleDefinitionOption = {
  id: string;
  name: string;
  nameEn: string | null;
  scope: RoleScopeValue;
  manualOnly: boolean;
};

type ProctorOption = { id: string; name: string; nameEn: string | null };
type FloorOption = { id: string; name: string; nameEn: string | null };
type RoomOption = {
  id: string;
  floorId: string;
  name: string;
  nameEn: string | null;
  supportedExamTypes: ExamType[];
};

type LockValidationResult = {
  isReady: boolean;
  issues: Array<{ code: string; message: string; buildingId?: string; expected?: number; actual?: number }>;
};

function apiError<T>(payload: ApiPayload<T>, fallback: string) {
  return payload.message ?? payload.error ?? fallback;
}

function formatDateTime(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function locationPath(assignment: AssignmentRecord, locale: Locale) {
  return [
    assignment.building ? getLocalizedName(assignment.building, locale) : null,
    assignment.floor ? getLocalizedName(assignment.floor, locale) : null,
    assignment.room ? getLocalizedName(assignment.room, locale) : null
  ]
    .filter(Boolean)
    .join(" / ");
}

export function SessionAssignmentsWorkspace({
  locale,
  messages,
  session
}: {
  locale: Locale;
  messages: Messages;
  session: SessionSummary;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [roles, setRoles] = useState<RoleDefinitionOption[]>([]);
  const [proctors, setProctors] = useState<ProctorOption[]>([]);
  const [lockValidation, setLockValidation] = useState<LockValidationResult | null>(null);
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [activeBuildingId, setActiveBuildingId] = useState(session.buildings[0]?.id ?? "");
  const [isAutoBusy, setIsAutoBusy] = useState(false);
  const [isRerankBusy, setIsRerankBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isManualBusy, setIsManualBusy] = useState(false);
  const [manual, setManual] = useState({
    userId: "",
    roleDefinitionId: "",
    buildingId: session.buildings[0]?.id ?? "",
    floorId: "",
    roomId: "",
    overrideNote: ""
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspace() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [aRes, rRes, pRes, lRes] = await Promise.all([
          fetch(`/api/assignments?sessionId=${session.id}&page=1&pageSize=500`, {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch("/api/assignments/roles", {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch("/api/proctors?includeInactive=false&page=1&pageSize=500", {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch(`/api/sessions/${session.id}/lock-validation`, {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          })
        ]);
        const aPayload = (await aRes.json()) as ApiPayload<AssignmentRecord[]>;
        const rPayload = (await rRes.json()) as ApiPayload<RoleDefinitionOption[]>;
        const pPayload = (await pRes.json()) as ApiPayload<ProctorOption[]>;
        const lPayload = (await lRes.json()) as ApiPayload<LockValidationResult>;

        if (!aRes.ok || !aPayload.ok || !aPayload.data) throw new Error(apiError(aPayload, messages.assignments.errors.loadFailed));
        if (!rRes.ok || !rPayload.ok || !rPayload.data) throw new Error(apiError(rPayload, messages.assignments.errors.loadFailed));
        if (!pRes.ok || !pPayload.ok || !pPayload.data) throw new Error(apiError(pPayload, messages.assignments.errors.loadFailed));
        if (!lRes.ok || !lPayload.ok || !lPayload.data) throw new Error(apiError(lPayload, messages.assignments.errors.loadFailed));

        setAssignments(aPayload.data);
        setRoles(rPayload.data);
        setProctors(pPayload.data);
        setLockValidation(lPayload.data);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : messages.assignments.errors.loadFailed);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadWorkspace();
    return () => controller.abort();
  }, [messages.assignments.errors.loadFailed, refreshKey, session.id]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFloors() {
      if (!manual.buildingId) return;
      const res = await fetch(`/api/locations/floors?buildingId=${manual.buildingId}&includeInactive=false&page=1&pageSize=200`, {
        credentials: "same-origin",
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      const payload = (await res.json()) as ApiPayload<FloorOption[]>;
      setFloors(res.ok && payload.ok && payload.data ? payload.data : []);
    }

    void loadFloors();
    return () => controller.abort();
  }, [manual.buildingId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRooms() {
      if (!manual.floorId) {
        setRooms([]);
        return;
      }
      const res = await fetch(`/api/locations/rooms?floorId=${manual.floorId}&includeInactive=false&page=1&pageSize=200`, {
        credentials: "same-origin",
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      const payload = (await res.json()) as ApiPayload<RoomOption[]>;
      const compatible = res.ok && payload.ok && payload.data ? payload.data.filter((room) => room.supportedExamTypes.includes(session.examType)) : [];
      setRooms(compatible);
    }

    void loadRooms();
    return () => controller.abort();
  }, [manual.floorId, session.examType]);

  const selectedRole = useMemo(() => roles.find((role) => role.id === manual.roleDefinitionId) ?? null, [manual.roleDefinitionId, roles]);
  const shownAssignments = useMemo(() => activeBuildingId ? assignments.filter((assignment) => assignment.buildingId === activeBuildingId) : assignments, [activeBuildingId, assignments]);

  async function runAutoAssign(dryRun: boolean) {
    setIsAutoBusy(true);
    try {
      const res = await fetch("/api/assignments/auto", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sessionId: session.id, dryRun })
      });
      const payload = (await res.json()) as ApiPayload<unknown>;
      if (!res.ok || !payload.ok) window.alert(apiError(payload, messages.assignments.errors.autoFailed));
      else if (!dryRun) setRefreshKey((current) => current + 1);
    } finally {
      setIsAutoBusy(false);
    }
  }

  async function runRerank(dryRun: boolean) {
    setIsRerankBusy(true);
    try {
      const res = await fetch("/api/assignments/rerank", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sessionId: session.id, dryRun })
      });
      const payload = (await res.json()) as ApiPayload<unknown>;
      if (!res.ok || !payload.ok) window.alert(apiError(payload, messages.assignments.errors.rerankFailed));
      else if (!dryRun) setRefreshKey((current) => current + 1);
    } finally {
      setIsRerankBusy(false);
    }
  }

  async function createManual() {
    if (!manual.userId || !manual.roleDefinitionId || !manual.buildingId) return setManualError(messages.assignments.errors.manualFailed);
    if (selectedRole?.scope === "FLOOR" && !manual.floorId) return setManualError(messages.assignments.errors.manualFailed);
    if (selectedRole?.scope === "ROOM" && (!manual.floorId || !manual.roomId)) return setManualError(messages.assignments.errors.manualFailed);
    setManualError(null);
    setIsManualBusy(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          userId: manual.userId,
          roleDefinitionId: manual.roleDefinitionId,
          buildingId: manual.buildingId,
          floorId: manual.floorId || undefined,
          roomId: manual.roomId || undefined,
          overrideNote: manual.overrideNote.trim() || undefined
        })
      });
      const payload = (await res.json()) as ApiPayload<unknown>;
      if (!res.ok || !payload.ok) return setManualError(apiError(payload, messages.assignments.errors.manualFailed));
      setManual((current) => ({ ...current, userId: "", roleDefinitionId: "", floorId: "", roomId: "", overrideNote: "" }));
      setRefreshKey((current) => current + 1);
    } finally {
      setIsManualBusy(false);
    }
  }

  if (isLoading) return <Card><CardHeader><CardTitle>{messages.assignments.title}</CardTitle><CardDescription>{messages.assignments.coverage.loading}</CardDescription></CardHeader></Card>;
  if (loadError) return <Card className="border-danger/40"><CardHeader><CardTitle>{messages.assignments.title}</CardTitle></CardHeader><CardContent><p className="text-sm text-danger">{loadError}</p></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8"><CardHeader><div className="flex flex-wrap gap-2"><Badge variant="accent">{messages.nav.sessions}</Badge><Badge>{messages.sessions.examTypes[session.examType]}</Badge><Badge>{messages.sessions.statuses[session.status as keyof typeof messages.sessions.statuses]}</Badge><Badge>{messages.sessions.statuses[session.derivedStatus as keyof typeof messages.sessions.statuses]}</Badge></div><CardTitle className="text-3xl">{messages.assignments.title}</CardTitle><CardDescription>{messages.assignments.subtitle}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Link href={`/sessions/${session.id}`} className="inline-flex h-11 items-center justify-center rounded-2xl bg-surface-elevated px-4 text-sm font-medium text-text-primary ring-1 ring-border transition-colors hover:bg-surface">{messages.assignments.backToSession}</Link><Button variant="secondary" onClick={() => setRefreshKey((current) => current + 1)}>{messages.assignments.refresh}</Button><Button variant="secondary" onClick={() => void runAutoAssign(true)} disabled={isAutoBusy}>{messages.assignments.automation.autoDryRun}</Button><Button onClick={() => void runAutoAssign(false)} disabled={isAutoBusy}>{messages.assignments.automation.autoExecute}</Button><Button variant="secondary" onClick={() => void runRerank(true)} disabled={isRerankBusy}>{messages.assignments.automation.rerankDryRun}</Button><Button onClick={() => void runRerank(false)} disabled={isRerankBusy}>{messages.assignments.automation.rerankExecute}</Button></CardContent></Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>{messages.assignments.coverage.title}</CardTitle><CardDescription>{lockValidation?.isReady ? messages.assignments.coverage.ready : messages.assignments.coverage.notReady}</CardDescription></CardHeader><CardContent className="space-y-2">{(lockValidation?.issues.length ?? 0) === 0 ? <p className="text-sm text-text-secondary">{messages.assignments.coverage.emptyIssues}</p> : lockValidation?.issues.map((issue, index) => <div key={`${issue.code}-${index}`} className="rounded-2xl border border-danger/40 bg-surface-elevated px-3 py-3"><p className="text-sm font-medium text-danger">{messages.assignments.issueCodes[issue.code as keyof typeof messages.assignments.issueCodes] ?? issue.code}</p><p className="mt-1 text-xs text-text-secondary">{issue.message}</p>{issue.expected !== undefined || issue.actual !== undefined ? <p className="mt-1 text-xs text-text-secondary">{messages.assignments.labels.expected}: {issue.expected ?? "-"} / {messages.assignments.labels.actual}: {issue.actual ?? "-"}</p> : null}</div>)}</CardContent></Card>

        <Card><CardHeader><CardTitle>{messages.assignments.manual.title}</CardTitle><CardDescription>{messages.assignments.manual.description}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><select className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary" value={manual.userId} onChange={(event) => setManual((current) => ({ ...current, userId: event.target.value }))}><option value="">{messages.assignments.manual.user}</option>{proctors.map((proctor) => <option key={proctor.id} value={proctor.id}>{getLocalizedName(proctor, locale)}</option>)}</select><select className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary" value={manual.roleDefinitionId} onChange={(event) => setManual((current) => ({ ...current, roleDefinitionId: event.target.value, roomId: "" }))}><option value="">{messages.assignments.manual.role}</option>{roles.map((role) => <option key={role.id} value={role.id}>{getLocalizedName(role, locale)}</option>)}</select><select className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary" value={manual.buildingId} onChange={(event) => setManual((current) => ({ ...current, buildingId: event.target.value, floorId: "", roomId: "" }))}><option value="">{messages.assignments.manual.building}</option>{session.buildings.map((building) => <option key={building.id} value={building.id}>{getLocalizedName(building, locale)}</option>)}</select><select className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary" value={manual.floorId} onChange={(event) => setManual((current) => ({ ...current, floorId: event.target.value, roomId: "" }))} disabled={selectedRole?.scope === "BUILDING"}><option value="">{messages.assignments.manual.floor}</option>{floors.map((floor) => <option key={floor.id} value={floor.id}>{getLocalizedName(floor, locale)}</option>)}</select><select className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary sm:col-span-2" value={manual.roomId} onChange={(event) => setManual((current) => ({ ...current, roomId: event.target.value }))} disabled={selectedRole?.scope !== "ROOM"}><option value="">{messages.assignments.manual.room}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{getLocalizedName(room, locale)}</option>)}</select></div><Input value={manual.overrideNote} onChange={(event) => setManual((current) => ({ ...current, overrideNote: event.target.value }))} placeholder={messages.assignments.manual.notes} />{manualError ? <p className="text-sm text-danger">{manualError}</p> : null}<div className="flex justify-end"><Button onClick={() => void createManual()} disabled={isManualBusy}>{isManualBusy ? messages.assignments.manual.submitting : messages.assignments.manual.submit}</Button></div></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>{messages.assignments.list.title}</CardTitle><CardDescription>{messages.assignments.list.description}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2">{session.buildings.map((building) => <button key={building.id} type="button" className={`rounded-2xl px-3 py-2 text-sm ring-1 transition-colors ${activeBuildingId === building.id ? "bg-accent text-white ring-transparent" : "bg-surface-elevated text-text-primary ring-border hover:bg-surface"}`} onClick={() => setActiveBuildingId(building.id)}>{getLocalizedName(building, locale)}</button>)}</div>{shownAssignments.length === 0 ? <p className="text-sm text-text-secondary">{messages.assignments.list.empty}</p> : <div className="space-y-3">{shownAssignments.map((assignment) => <div key={assignment.id} className="rounded-2xl border border-border bg-surface-elevated px-4 py-4"><div className="flex flex-wrap gap-2"><Badge>{messages.assignments.statuses[assignment.status]}</Badge><Badge>{messages.assignments.methods[assignment.assignedMethod]}</Badge><Badge>{messages.assignments.scopes[assignment.roleDefinition.scope]}</Badge></div><p className="mt-3 text-base font-semibold text-text-primary">{getLocalizedName(assignment.user, locale)}</p><p className="text-sm text-text-secondary">{getLocalizedName(assignment.roleDefinition, locale)}</p><div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4"><p>{messages.assignments.labels.location}: {locationPath(assignment, locale)}</p><p>{messages.assignments.labels.assignedAt}: {formatDateTime(locale, assignment.assignedAt)}</p><p>{messages.assignments.labels.status}: {messages.assignments.statuses[assignment.status]}</p><p>{messages.assignments.labels.method}: {messages.assignments.methods[assignment.assignedMethod]}</p></div>{assignment.overrideNote ? <p className="mt-2 text-sm text-text-secondary">{assignment.overrideNote}</p> : null}</div>)}</div>}</CardContent></Card>
    </div>
  );
}
