"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

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
import { getAlternateLocalizedName, getLocalizedName } from "@/lib/i18n/presentation";
import {
  getAllowedSessionStatusTransitions,
  sessionStatuses,
  type SessionStatusValue
} from "@/lib/sessions/status-ui";

import { SessionStatusBadge } from "./session-status-badge";

type ExamType = "EST1" | "EST2" | "EST_ASSN";

type CycleOption = {
  id: string;
  name: string;
  nameEn: string | null;
};

type BuildingOption = {
  id: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  university: {
    name: string;
    nameEn: string | null;
    governorate: {
      name: string;
      nameEn: string | null;
    };
  };
};

type SessionRecord = {
  id: string;
  cycleId: string;
  name: string;
  nameEn: string | null;
  examType: ExamType;
  startDateTime: string | null;
  endDateTime: string | null;
  status: SessionStatusValue;
  derivedStatus: SessionStatusValue;
  notes: string | null;
  isActive: boolean;
  updatedAt: string;
  cycle: CycleOption;
  buildings: Array<{
    buildingId: string;
    isActive: boolean;
    building: BuildingOption;
  }>;
  _count: {
    assignments: number;
    buildings: number;
    evaluations: number;
    waitingList: number;
  };
};

type PaginationMeta = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageCount: number;
  total: number;
};

type ApiPayload<T> = {
  ok: boolean;
  data?: T;
  pagination?: PaginationMeta;
  error?: string;
  message?: string;
};

type FormState = {
  cycleId: string;
  name: string;
  nameEn: string;
  examType: ExamType;
  startDateTime: string;
  endDateTime: string;
  buildingIds: string[];
  notes: string;
  isActive: boolean;
};

type SessionsWorkspaceProps = {
  locale: Locale;
  messages: Messages;
  canManageStatus: boolean;
};

const selectClassName =
  "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent";

const pageSizeOptions = [10, 25, 50];
const examTypes: ExamType[] = ["EST1", "EST2", "EST_ASSN"];

function normalizeOptionalText(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toZonedDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");

  return `${value}:00${sign}${hours}:${minutes}`;
}

function formatDateTime(locale: Locale, value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function buildBuildingPath(building: BuildingOption, locale: Locale) {
  return [
    getLocalizedName(building, locale),
    getLocalizedName(building.university, locale),
    getLocalizedName(building.university.governorate, locale)
  ].join(" / ");
}

function getInitialFormState(): FormState {
  return {
    cycleId: "",
    name: "",
    nameEn: "",
    examType: "EST1",
    startDateTime: "",
    endDateTime: "",
    buildingIds: [],
    notes: "",
    isActive: true
  };
}

function replaceTokens(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template
  );
}

function getApiError(payload: { message?: string; error?: string }, fallback: string) {
  return payload.message ?? payload.error ?? fallback;
}

function getStatusErrorMessage(messages: Messages, errorCode?: string | null) {
  if (!errorCode) {
    return messages.sessions.errorBody;
  }

  const knownErrors = messages.sessions.statusErrors as Record<string, string>;
  return knownErrors[errorCode] ?? errorCode;
}

function canPermanentlyDeleteSession(session: SessionRecord) {
  return (
    session._count.assignments === 0 &&
    session._count.waitingList === 0 &&
    session._count.evaluations === 0
  );
}

function SessionListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-16 animate-pulse rounded-3xl border border-border bg-surface-elevated"
        />
      ))}
    </div>
  );
}

export function SessionsWorkspace({ locale, messages, canManageStatus }: SessionsWorkspaceProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SessionStatusValue>("");
  const [startFrom, setStartFrom] = useState("");
  const [endTo, setEndTo] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    hasNextPage: false,
    hasPreviousPage: false,
    page: 1,
    pageCount: 1,
    total: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionRecord | null>(null);
  const [formState, setFormState] = useState<FormState>(() => getInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deactivatingSessionId, setDeactivatingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [statusBusyById, setStatusBusyById] = useState<Record<string, boolean>>({});
  const [statusErrorById, setStatusErrorById] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchTerm(searchInput.trim()), 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSessions() {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      const params = new URLSearchParams({
        includeInactive: includeInactive ? "true" : "false",
        page: String(page),
        pageSize: String(pageSize)
      });

      if (searchTerm) params.set("search", searchTerm);
      if (cycleFilter) params.set("cycleId", cycleFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (startFrom) params.set("startFrom", toZonedDateTime(startFrom));
      if (endTo) params.set("endTo", toZonedDateTime(endTo));

      try {
        const response = await fetch(`/api/sessions?${params.toString()}`, {
          credentials: "same-origin",
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        const payload = (await response.json()) as ApiPayload<SessionRecord[]>;

        if (!response.ok || !payload.ok || !payload.data || !payload.pagination) {
          throw new Error(getApiError(payload, messages.sessions.errorBody));
        }

        setSessions(payload.data);
        setPagination(payload.pagination);
      } catch (loadError) {
        if (controller.signal.aborted) return;

        setSessions([]);
        setError(messages.sessions.errorBody);
        setErrorCode(loadError instanceof Error ? loadError.message : "sessions_request_failed");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadSessions();

    return () => controller.abort();
  }, [cycleFilter, endTo, includeInactive, messages.sessions.errorBody, page, pageSize, refreshKey, searchTerm, startFrom, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      setIsOptionsLoading(true);

      try {
        const [cyclesResponse, buildingsResponse] = await Promise.all([
          fetch("/api/cycles?includeInactive=true&page=1&pageSize=100", {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          }),
          fetch("/api/locations/buildings?includeInactive=true&page=1&pageSize=100", {
            credentials: "same-origin",
            signal: controller.signal,
            headers: { Accept: "application/json" }
          })
        ]);

        const cyclesPayload = (await cyclesResponse.json()) as ApiPayload<CycleOption[]>;
        const buildingsPayload = (await buildingsResponse.json()) as ApiPayload<BuildingOption[]>;

        if (cyclesResponse.ok && cyclesPayload.ok && cyclesPayload.data) {
          setCycles(cyclesPayload.data);
        }

        if (buildingsResponse.ok && buildingsPayload.ok && buildingsPayload.data) {
          setBuildings(buildingsPayload.data);
        }
      } catch {
        setCycles([]);
        setBuildings([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsOptionsLoading(false);
        }
      }
    }

    void loadOptions();

    return () => controller.abort();
  }, []);

  const metrics = useMemo(
    () => [
      {
        label: messages.sessions.labels.assignments,
        value: sessions.reduce((sum, session) => sum + session._count.assignments, 0)
      },
      {
        label: messages.sessions.labels.waitingList,
        value: sessions.reduce((sum, session) => sum + session._count.waitingList, 0)
      },
      {
        label: messages.sessions.labels.evaluations,
        value: sessions.reduce((sum, session) => sum + session._count.evaluations, 0)
      },
      {
        label: messages.sessions.labels.buildings,
        value: sessions.reduce((sum, session) => sum + session._count.buildings, 0)
      }
    ],
    [messages.sessions.labels, sessions]
  );

  function openCreateModal() {
    setEditingSession(null);
    setFormState(getInitialFormState());
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditModal(session: SessionRecord) {
    setEditingSession(session);
    setFormState({
      cycleId: session.cycleId,
      name: session.name,
      nameEn: session.nameEn ?? "",
      examType: session.examType,
      startDateTime: toLocalDateTimeInput(session.startDateTime),
      endDateTime: toLocalDateTimeInput(session.endDateTime),
      buildingIds: session.buildings
        .filter((buildingLink) => buildingLink.isActive)
        .map((buildingLink) => buildingLink.buildingId),
      notes: session.notes ?? "",
      isActive: session.isActive
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  function closeFormModal() {
    setIsFormOpen(false);
    setEditingSession(null);
    setFormError(null);
    setFormState(getInitialFormState());
  }

  function toggleBuilding(buildingId: string) {
    setFormState((current) => {
      if (current.buildingIds.includes(buildingId)) {
        return {
          ...current,
          buildingIds: current.buildingIds.filter((currentId) => currentId !== buildingId)
        };
      }

      return {
        ...current,
        buildingIds: [...current.buildingIds, buildingId]
      };
    });
  }

  async function submitForm() {
    const name = normalizeOptionalText(formState.name);
    const nameEn = normalizeOptionalText(formState.nameEn);

    if (!formState.cycleId) {
      setFormError(messages.sessions.form.cycleRequired);
      return;
    }

    if (!name && !nameEn) {
      setFormError(messages.sessions.form.nameRequired);
      return;
    }

    if (!formState.startDateTime || !formState.endDateTime) {
      setFormError(messages.sessions.form.dateRangeInvalid);
      return;
    }

    if (new Date(formState.startDateTime).getTime() >= new Date(formState.endDateTime).getTime()) {
      setFormError(messages.sessions.form.dateRangeInvalid);
      return;
    }

    if (formState.buildingIds.length === 0) {
      setFormError(messages.sessions.form.buildingRequired);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      cycleId: formState.cycleId,
      name,
      nameEn,
      examType: formState.examType,
      startDateTime: toZonedDateTime(formState.startDateTime),
      endDateTime: toZonedDateTime(formState.endDateTime),
      buildingIds: formState.buildingIds,
      notes: normalizeOptionalText(formState.notes),
      isActive: formState.isActive
    };

    try {
      const endpoint = editingSession ? `/api/sessions/${editingSession.id}` : "/api/sessions";
      const method = editingSession ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as ApiPayload<SessionRecord>;

      if (!response.ok || !result.ok || !result.data) {
        setFormError(getApiError(result, messages.sessions.errorBody));
        return;
      }

      closeFormModal();
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : messages.sessions.errorBody
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deactivateSession(session: SessionRecord) {
    const confirmed = window.confirm(
      `${messages.sessions.actions.deactivate}: ${getLocalizedName(session, locale)}?`
    );

    if (!confirmed) {
      return;
    }

    setDeactivatingSessionId(session.id);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as ApiPayload<SessionRecord>;

      if (!response.ok || !payload.ok) {
        window.alert(getApiError(payload, messages.sessions.errorBody));
        return;
      }

      setRefreshKey((current) => current + 1);
    } catch (removeError) {
      window.alert(
        removeError instanceof Error ? removeError.message : messages.sessions.errorBody
      );
    } finally {
      setDeactivatingSessionId(null);
    }
  }

  async function permanentlyDeleteSession(session: SessionRecord) {
    const confirmed = window.confirm(messages.sessions.actions.deletePermanentConfirm);

    if (!confirmed) {
      return;
    }

    setDeletingSessionId(session.id);

    try {
      const response = await fetch(`/api/sessions/${session.id}?mode=hard`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as ApiPayload<SessionRecord>;

      if (!response.ok || !payload.ok) {
        window.alert(getApiError(payload, messages.sessions.errorBody));
        return;
      }

      setRefreshKey((current) => current + 1);
    } catch (removeError) {
      window.alert(
        removeError instanceof Error ? removeError.message : messages.sessions.errorBody
      );
    } finally {
      setDeletingSessionId(null);
    }
  }

  async function changeSessionStatus(sessionId: string, nextStatus: SessionStatusValue) {
    setStatusBusyById((current) => ({ ...current, [sessionId]: true }));
    setStatusErrorById((current) => ({ ...current, [sessionId]: null }));

    try {
      const response = await fetch(`/api/sessions/${sessionId}/status`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const payload = (await response.json()) as ApiPayload<SessionRecord>;

      if (!response.ok || !payload.ok || !payload.data) {
        setStatusErrorById((current) => ({
          ...current,
          [sessionId]: getStatusErrorMessage(messages, payload.error ?? payload.message)
        }));
        return;
      }

      setSessions((current) =>
        current.map((session) => (session.id === sessionId ? payload.data! : session))
      );
    } catch (mutationError) {
      setStatusErrorById((current) => ({
        ...current,
        [sessionId]:
          mutationError instanceof Error
            ? getStatusErrorMessage(messages, mutationError.message)
            : messages.sessions.errorBody
      }));
    } finally {
      setStatusBusyById((current) => ({ ...current, [sessionId]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.nav.sessions }
        ]}
        title={messages.sessions.title}
        description={messages.sessions.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.sessions.pagination.total.replace("{total}", "").trim()}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text-primary">
              {pagination.total}
            </p>
          </>
        }
        body={
          <div className="space-y-4">
          <p className="max-w-3xl text-sm leading-7 text-text-secondary">
            {messages.sessions.description}
          </p>
          <p className="max-w-3xl text-xs leading-6 text-text-secondary">
            {messages.sessions.deleteHelp}
          </p>

          <div className="grid gap-4 xl:grid-cols-5">
            <div className="space-y-2 xl:col-span-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="sessions-search">
                {messages.sessions.searchLabel}
              </label>
              <Input
                id="sessions-search"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setPage(1);
                }}
                placeholder={messages.sessions.searchPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="sessions-cycle-filter">
                {messages.sessions.filters.cycle}
              </label>
              <select
                id="sessions-cycle-filter"
                value={cycleFilter}
                onChange={(event) => {
                  setCycleFilter(event.target.value);
                  setPage(1);
                }}
                className={selectClassName}
              >
                <option value="">{messages.sessions.filters.allCycles}</option>
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {getLocalizedName(cycle, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="sessions-status-filter">
                {messages.sessions.filters.status}
              </label>
              <select
                id="sessions-status-filter"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as "" | SessionStatusValue);
                  setPage(1);
                }}
                className={selectClassName}
              >
                <option value="">{messages.sessions.filters.allStatuses}</option>
                {sessionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {messages.sessions.statuses[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="sessions-page-size">
                {messages.sessions.pagination.pageSize}
              </label>
              <select
                id="sessions-page-size"
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className={selectClassName}
              >
                {pageSizeOptions.map((sizeOption) => (
                  <option key={sizeOption} value={String(sizeOption)}>
                    {sizeOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="sessions-start-from">
                {messages.sessions.filters.startFrom}
              </label>
              <Input
                id="sessions-start-from"
                type="datetime-local"
                value={startFrom}
                onChange={(event) => {
                  setStartFrom(event.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="sessions-end-to">
                {messages.sessions.filters.endTo}
              </label>
              <Input
                id="sessions-end-to"
                type="datetime-local"
                value={endTo}
                onChange={(event) => {
                  setEndTo(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {isOptionsLoading ? (
            <p className="text-xs text-text-secondary">{messages.sessions.loadingCycles}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={openCreateModal}>
              {messages.sessions.create}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIncludeInactive((current) => !current);
                setPage(1);
              }}
            >
              {includeInactive ? messages.sessions.showActiveOnly : messages.sessions.showInactive}
            </Button>
            <IconButton
              variant="secondary"
              size="sm"
              icon={<RefreshIcon />}
              label={messages.sessions.reload}
              onClick={() => setRefreshKey((current) => current + 1)}
            />
          </div>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{messages.sessions.snapshotTitle}</CardTitle>
          <CardDescription>{messages.sessions.snapshotBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardHeader>
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="text-3xl">{metric.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.sessions.listTitle}</CardTitle>
          <CardDescription>
            {replaceTokens(messages.sessions.listBody, { count: sessions.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <SessionListSkeleton />
          ) : !isLoading && error ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-5 py-5">
              <h3 className="text-lg font-semibold text-text-primary">{messages.sessions.errorTitle}</h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">{error}</p>
              {errorCode ? (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-danger">{errorCode}</p>
              ) : null}
            </div>
          ) : sessions.length === 0 ? (
            <DataTableEmptyState
              title={messages.sessions.emptyTitle}
              description={messages.sessions.emptyBody}
            />
          ) : (
            <>
              <div className="rounded-[24px] border border-border bg-surface-elevated">
                <DataTable>
                  <DataTableHeader>
                    <tr>
                      <DataTableHead>{messages.sessions.listTitle}</DataTableHead>
                      <DataTableHead>{messages.sessions.labels.cycle}</DataTableHead>
                      <DataTableHead>{messages.sessions.labels.location}</DataTableHead>
                      <DataTableHead>{messages.sessions.labels.startDateTime}</DataTableHead>
                      <DataTableHead>{messages.sessions.labels.assignments}</DataTableHead>
                      <DataTableHead>{messages.sessions.labels.waitingList}</DataTableHead>
                      <DataTableHead>{messages.sessions.labels.evaluations}</DataTableHead>
                      <DataTableHead className="w-[28rem]">{messages.sessions.actions.view}</DataTableHead>
                    </tr>
                  </DataTableHeader>
                  <DataTableBody>
                    {sessions.map((session) => {
                      const localizedName = getLocalizedName(session, locale);
                      const alternateName = getAlternateLocalizedName(session, locale);
                      const availableTransitions = getAllowedSessionStatusTransitions({
                        status: session.status,
                        isActive: session.isActive,
                        startDateTime: session.startDateTime,
                        endDateTime: session.endDateTime,
                        assignmentsCount: session._count.assignments,
                        waitingListCount: session._count.waitingList,
                        evaluationsCount: session._count.evaluations
                      });
                      const isStatusBusy = statusBusyById[session.id] ?? false;
                      const isDeactivating = deactivatingSessionId === session.id;
                      const isDeleting = deletingSessionId === session.id;
                      const isMutating = isDeactivating || isDeleting;
                      const allowPermanentDelete = canPermanentlyDeleteSession(session);
                      const activeBuildingNames = session.buildings
                        .filter((buildingLink) => buildingLink.isActive)
                        .map((buildingLink) => getLocalizedName(buildingLink.building, locale));

                      return (
                        <DataTableRow key={session.id}>
                          <DataTableCell>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <Badge>{messages.sessions.examTypes[session.examType]}</Badge>
                                <Badge>
                                  {session.isActive
                                    ? messages.sessions.labels.active
                                    : messages.sessions.labels.inactive}
                                </Badge>
                                <SessionStatusBadge
                                  status={session.status}
                                  label={messages.sessions.statuses[session.status]}
                                />
                                <SessionStatusBadge
                                  status={session.derivedStatus}
                                  label={messages.sessions.statuses[session.derivedStatus]}
                                />
                              </div>
                              <div>
                                <p className="font-semibold text-text-primary">{localizedName}</p>
                                {alternateName ? (
                                  <p className="text-xs text-text-secondary">{alternateName}</p>
                                ) : null}
                              </div>
                            </div>
                          </DataTableCell>
                          <DataTableCell>{getLocalizedName(session.cycle, locale)}</DataTableCell>
                          <DataTableCell>{activeBuildingNames.join(" / ") || "-"}</DataTableCell>
                          <DataTableCell>
                            <div className="space-y-1">
                              <p>{formatDateTime(locale, session.startDateTime)}</p>
                              <p className="text-xs text-text-secondary">
                                {formatDateTime(locale, session.endDateTime)}
                              </p>
                            </div>
                          </DataTableCell>
                          <DataTableCell>{session._count.assignments}</DataTableCell>
                          <DataTableCell>{session._count.waitingList}</DataTableCell>
                          <DataTableCell>{session._count.evaluations}</DataTableCell>
                          <DataTableCell>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/sessions/${session.id}`}
                                  className="inline-flex h-9 items-center justify-center rounded-xl bg-background px-3 text-sm font-medium text-text-primary ring-1 ring-border transition-colors hover:bg-surface"
                                >
                                  {messages.sessions.actions.view}
                                </Link>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openEditModal(session)}
                                  disabled={isMutating}
                                >
                                  {messages.sessions.actions.edit}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void deactivateSession(session)}
                                  disabled={isMutating || !session.isActive}
                                >
                                  {isDeactivating
                                    ? messages.sessions.actions.deactivating
                                    : messages.sessions.actions.deactivate}
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => void permanentlyDeleteSession(session)}
                                  disabled={isMutating || !allowPermanentDelete}
                                >
                                  {isDeleting
                                    ? messages.sessions.actions.deletingPermanent
                                    : messages.sessions.actions.deletePermanent}
                                </Button>
                              </div>

                              {canManageStatus ? (
                                <div className="space-y-2 rounded-2xl border border-border bg-background px-3 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                                    {messages.sessions.actions.transitionsTitle}
                                  </p>
                                  {availableTransitions.length === 0 ? (
                                    <p className="text-sm text-text-secondary">
                                      {messages.sessions.actions.noTransitions}
                                    </p>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {availableTransitions.map((nextStatus) => (
                                        <Button
                                          key={nextStatus}
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => void changeSessionStatus(session.id, nextStatus)}
                                          disabled={isStatusBusy || isMutating || !session.isActive}
                                        >
                                          {isStatusBusy
                                            ? messages.sessions.actions.changingStatus
                                            : `${messages.sessions.actions.changeStatus}: ${messages.sessions.statuses[nextStatus]}`}
                                        </Button>
                                      ))}
                                    </div>
                                  )}

                                  {statusErrorById[session.id] ? (
                                    <p className="text-sm text-danger">{statusErrorById[session.id]}</p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              </div>

              <PaginationControls
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={pagination.total}
                hasPreviousPage={pagination.hasPreviousPage}
                hasNextPage={pagination.hasNextPage}
                summaryLabel={replaceTokens(messages.sessions.pagination.summary, {
                  page: pagination.page,
                  pageCount: pagination.pageCount
                })}
                totalLabel={replaceTokens(messages.sessions.pagination.total, {
                  total: pagination.total
                })}
                previousLabel={messages.sessions.pagination.previous}
                nextLabel={messages.sessions.pagination.next}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => current + 1)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {isFormOpen ? (
        <ModalFrame
          title={editingSession ? messages.sessions.form.editTitle : messages.sessions.form.createTitle}
          description={messages.sessions.form.subtitle}
          closeLabel={messages.sessions.form.cancel}
          onClose={closeFormModal}
          className="max-w-5xl"
          bodyClassName="space-y-4"
        >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="session-cycle">
                    {messages.sessions.form.cycle}
                  </label>
                  <select
                    id="session-cycle"
                    value={formState.cycleId}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, cycleId: event.target.value }))
                    }
                    className={selectClassName}
                  >
                    <option value="">{messages.sessions.filters.allCycles}</option>
                    {cycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {getLocalizedName(cycle, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="session-exam-type">
                    {messages.sessions.form.examType}
                  </label>
                  <select
                    id="session-exam-type"
                    value={formState.examType}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        examType: event.target.value as ExamType
                      }))
                    }
                    className={selectClassName}
                  >
                    {examTypes.map((examType) => (
                      <option key={examType} value={examType}>
                        {messages.sessions.examTypes[examType]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="session-name-ar">
                    {messages.sessions.form.nameAr}
                  </label>
                  <Input
                    id="session-name-ar"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="session-name-en">
                    {messages.sessions.form.nameEn}
                  </label>
                  <Input
                    id="session-name-en"
                    value={formState.nameEn}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, nameEn: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="session-start-date-time">
                    {messages.sessions.form.startDateTime}
                  </label>
                  <Input
                    id="session-start-date-time"
                    type="datetime-local"
                    value={formState.startDateTime}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, startDateTime: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="session-end-date-time">
                    {messages.sessions.form.endDateTime}
                  </label>
                  <Input
                    id="session-end-date-time"
                    type="datetime-local"
                    value={formState.endDateTime}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, endDateTime: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">{messages.sessions.form.buildingIds}</label>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-border bg-surface px-3 py-3">
                  {buildings.map((building) => {
                    const isSelected = formState.buildingIds.includes(building.id);

                    return (
                      <label
                        key={building.id}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-elevated px-3 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleBuilding(building.id)}
                        />
                        <span className="space-y-1 text-sm text-text-primary">
                          <span className="block font-medium">{buildBuildingPath(building, locale)}</span>
                          <span className="block text-xs text-text-secondary">
                            {building.code ? `${messages.cycles.labels.code}: ${building.code}` : "-"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="session-notes">
                  {messages.sessions.form.notes}
                </label>
                <textarea
                  id="session-notes"
                  rows={4}
                  className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-text-primary" htmlFor="session-active">
                <input
                  id="session-active"
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                {messages.sessions.form.isActive}
              </label>

              {formError ? (
                <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4">
                  <p className="text-sm text-danger">{formError}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={closeFormModal}>
                  {messages.sessions.form.cancel}
                </Button>
                <Button onClick={() => void submitForm()} disabled={isSubmitting}>
                  {isSubmitting
                    ? messages.sessions.form.submitting
                    : editingSession
                      ? messages.sessions.form.submitEdit
                      : messages.sessions.form.submitCreate}
                </Button>
              </div>
        </ModalFrame>
      ) : null}
    </div>
  );
}
