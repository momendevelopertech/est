"use client";

import { useEffect, useMemo, useState } from "react";

import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/ui/page-hero";
import type { Locale, Messages } from "@/lib/i18n";
import { getLocalizedName } from "@/lib/i18n/presentation";

type WaitingListStatusValue = "WAITING" | "PROMOTED" | "REMOVED";
type RoleScopeValue = "BUILDING" | "FLOOR" | "ROOM";
type ApiPayload<T> = { ok: boolean; data?: T; error?: string; message?: string };

type SessionSummary = {
  id: string;
  name?: string;
  nameEn?: string | null;
  examType: "EST1" | "EST2" | "EST_ASSN";
  status: string;
  derivedStatus: string;
  isActive?: boolean;
  buildings: Array<{ id: string; name: string; nameEn: string | null }>;
};

type WaitingListEntry = {
  id: string;
  sessionId: string;
  userId: string;
  buildingId: string | null;
  roleDefinitionId: string | null;
  priority: number;
  status: WaitingListStatusValue;
  entrySource: string | null;
  reason: string | null;
  notes: string | null;
  promotedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    nameEn: string | null;
    averageRating: string;
    totalSessions: number;
  };
  building: {
    id: string;
    name: string;
    nameEn: string | null;
  } | null;
  roleDefinition: {
    id: string;
    name: string;
    nameEn: string | null;
    scope: RoleScopeValue;
  } | null;
};

type RoleDefinitionOption = {
  id: string;
  name: string;
  nameEn: string | null;
  scope: RoleScopeValue;
  manualOnly: boolean;
};

type ProctorOption = { id: string; name: string; nameEn: string | null };

function apiError<T>(payload: ApiPayload<T>, fallback: string) {
  return payload.message ?? payload.error ?? fallback;
}

function formatDateTime(locale: Locale, value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function SessionWaitingListWorkspace({
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
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [proctors, setProctors] = useState<ProctorOption[]>([]);
  const [roles, setRoles] = useState<RoleDefinitionOption[]>([]);
  const [activeStatus, setActiveStatus] = useState<WaitingListStatusValue | "ALL">("WAITING");
  const [isBusy, setIsBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    userId: "",
    buildingId: session.buildings[0]?.id ?? "",
    roleDefinitionId: "",
    entrySource: "manual",
    reason: "",
    notes: ""
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspace() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [wRes, pRes, rRes] = await Promise.all([
          fetch(`/api/waiting-list?sessionId=${session.id}&page=1&pageSize=500`, {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch("/api/proctors?includeInactive=false&page=1&pageSize=500", {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch("/api/assignments/roles", {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          })
        ]);
        const wPayload = (await wRes.json()) as ApiPayload<WaitingListEntry[]>;
        const pPayload = (await pRes.json()) as ApiPayload<ProctorOption[]>;
        const rPayload = (await rRes.json()) as ApiPayload<RoleDefinitionOption[]>;

        if (!wRes.ok || !wPayload.ok || !wPayload.data) {
          throw new Error(apiError(wPayload, messages.waitingList.errors.loadFailed));
        }

        if (!pRes.ok || !pPayload.ok || !pPayload.data) {
          throw new Error(apiError(pPayload, messages.waitingList.errors.loadFailed));
        }

        if (!rRes.ok || !rPayload.ok || !rPayload.data) {
          throw new Error(apiError(rPayload, messages.waitingList.errors.loadFailed));
        }

        setEntries(wPayload.data);
        setProctors(pPayload.data);
        setRoles(rPayload.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : messages.waitingList.errors.loadFailed
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();
    return () => controller.abort();
  }, [messages.waitingList.errors.loadFailed, refreshKey, session.id]);

  const visibleEntries = useMemo(
    () =>
      activeStatus === "ALL"
        ? entries
        : entries.filter((entry) => entry.status === activeStatus),
    [activeStatus, entries]
  );

  async function submitCreate() {
    if (!form.userId || !form.buildingId || !form.roleDefinitionId) {
      setFormError(messages.waitingList.errors.createFailed);
      return;
    }

    setFormError(null);
    setIsBusy(true);

    try {
      const res = await fetch("/api/waiting-list", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          userId: form.userId,
          buildingId: form.buildingId,
          roleDefinitionId: form.roleDefinitionId,
          entrySource: form.entrySource || "manual",
          reason: form.reason || undefined,
          notes: form.notes || undefined
        })
      });
      const payload = (await res.json()) as ApiPayload<unknown>;

      if (!res.ok || !payload.ok) {
        setFormError(apiError(payload, messages.waitingList.errors.createFailed));
        return;
      }

      setForm({
        userId: "",
        buildingId: session.buildings[0]?.id ?? "",
        roleDefinitionId: "",
        entrySource: "manual",
        reason: "",
        notes: ""
      });
      setRefreshKey((current) => current + 1);
    } finally {
      setIsBusy(false);
    }
  }

  async function promoteEntry(entry: WaitingListEntry) {
    if (!entry.buildingId || !entry.roleDefinitionId) {
      window.alert(messages.waitingList.errors.promoteFailed);
      return;
    }

    setIsBusy(true);

    try {
      const res = await fetch(`/api/waiting-list/${entry.id}/promote`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          buildingId: entry.buildingId,
          roleDefinitionId: entry.roleDefinitionId
        })
      });
      const payload = (await res.json()) as ApiPayload<unknown>;

      if (!res.ok || !payload.ok) {
        window.alert(apiError(payload, messages.waitingList.errors.promoteFailed));
        return;
      }

      setRefreshKey((current) => current + 1);
    } finally {
      setIsBusy(false);
    }
  }

  async function removeEntry(entry: WaitingListEntry) {
    setIsBusy(true);

    try {
      const res = await fetch(`/api/waiting-list/${entry.id}/remove`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({})
      });
      const payload = (await res.json()) as ApiPayload<unknown>;

      if (!res.ok || !payload.ok) {
        window.alert(apiError(payload, messages.waitingList.errors.removeFailed));
        return;
      }

      setRefreshKey((current) => current + 1);
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{messages.waitingList.title}</CardTitle>
          <CardDescription>{messages.waitingList.loading}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-danger/40">
        <CardHeader>
          <CardTitle>{messages.waitingList.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-danger">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.nav.sessions, variant: "accent" },
          { label: messages.sessions.examTypes[session.examType] },
          { label: messages.sessions.statuses[session.status as keyof typeof messages.sessions.statuses] },
          { label: messages.sessions.statuses[session.derivedStatus as keyof typeof messages.sessions.statuses] }
        ]}
        title={messages.waitingList.title}
        description={messages.waitingList.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.waitingList.list.title}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              {visibleEntries.length}
            </p>
          </>
        }
        actions={
          <>
            <ActionLink href={`/sessions/${session.id}`}>{messages.waitingList.backToSession}</ActionLink>
            <Button variant="secondary" onClick={() => setRefreshKey((current) => current + 1)}>
              {messages.waitingList.refresh}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{messages.waitingList.create.title}</CardTitle>
            <CardDescription>{messages.waitingList.create.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
                value={form.userId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, userId: event.target.value }))
                }
              >
                <option value="">{messages.waitingList.create.user}</option>
                {proctors.map((proctor) => (
                  <option key={proctor.id} value={proctor.id}>
                    {getLocalizedName(proctor, locale)}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
                value={form.buildingId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, buildingId: event.target.value }))
                }
              >
                <option value="">{messages.waitingList.create.building}</option>
                {session.buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {getLocalizedName(building, locale)}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary"
                value={form.roleDefinitionId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, roleDefinitionId: event.target.value }))
                }
              >
                <option value="">{messages.waitingList.create.role}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {getLocalizedName(role, locale)}
                  </option>
                ))}
              </select>
              <Input
                value={form.entrySource}
                onChange={(event) =>
                  setForm((current) => ({ ...current, entrySource: event.target.value }))
                }
                placeholder={messages.waitingList.create.entrySource}
              />
            </div>
            <Input
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({ ...current, reason: event.target.value }))
              }
              placeholder={messages.waitingList.create.reason}
            />
            <Input
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder={messages.waitingList.create.notes}
            />
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <div className="flex justify-end">
              <Button onClick={() => void submitCreate()} disabled={isBusy}>
                {isBusy ? messages.waitingList.create.submitting : messages.waitingList.create.submit}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{messages.waitingList.filters.title}</CardTitle>
            <CardDescription>{messages.waitingList.filters.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(["ALL", "WAITING", "PROMOTED", "REMOVED"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={`rounded-2xl px-3 py-2 text-sm ring-1 transition-colors ${
                  activeStatus === status
                    ? "bg-accent text-white ring-transparent"
                    : "bg-surface-elevated text-text-primary ring-border hover:bg-surface"
                }`}
                onClick={() => setActiveStatus(status)}
              >
                {status === "ALL"
                  ? messages.waitingList.filters.all
                  : messages.waitingList.statuses[status]}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{messages.waitingList.list.title}</CardTitle>
          <CardDescription>{messages.waitingList.list.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleEntries.length === 0 ? (
            <p className="text-sm text-text-secondary">{messages.waitingList.list.empty}</p>
          ) : (
            visibleEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-border bg-surface-elevated px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{messages.waitingList.statuses[entry.status]}</Badge>
                  <Badge>{messages.waitingList.labels.priority}: {entry.priority}</Badge>
                  {entry.roleDefinition ? (
                    <Badge>{getLocalizedName(entry.roleDefinition, locale)}</Badge>
                  ) : null}
                </div>

                <p className="mt-3 text-base font-semibold text-text-primary">
                  {getLocalizedName(entry.user, locale)}
                </p>
                <div className="mt-2 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
                  <p>{messages.waitingList.labels.rating}: {entry.user.averageRating}</p>
                  <p>{messages.waitingList.labels.totalSessions}: {entry.user.totalSessions}</p>
                  <p>{messages.waitingList.labels.source}: {entry.entrySource ?? "-"}</p>
                  <p>{messages.waitingList.labels.createdAt}: {formatDateTime(locale, entry.createdAt)}</p>
                  <p>{messages.waitingList.labels.building}: {entry.building ? getLocalizedName(entry.building, locale) : "-"}</p>
                  <p>{messages.waitingList.labels.promotedAt}: {formatDateTime(locale, entry.promotedAt)}</p>
                  <p>{messages.waitingList.labels.removedAt}: {formatDateTime(locale, entry.removedAt)}</p>
                </div>

                {entry.reason ? (
                  <p className="mt-2 text-sm text-text-secondary">
                    {messages.waitingList.labels.reason}: {entry.reason}
                  </p>
                ) : null}

                {entry.notes ? <p className="mt-1 text-sm text-text-secondary">{entry.notes}</p> : null}

                {entry.status === "WAITING" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => void promoteEntry(entry)}
                      disabled={isBusy}
                    >
                      {messages.waitingList.actions.promote}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void removeEntry(entry)}
                      disabled={isBusy}
                    >
                      {messages.waitingList.actions.remove}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
