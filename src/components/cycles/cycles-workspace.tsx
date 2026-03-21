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
import { Input } from "@/components/ui/input";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { Locale, Messages } from "@/lib/i18n";
import {
  getAlternateLocalizedName,
  getLocalizedName
} from "@/lib/i18n/presentation";

type CycleStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
type CloneMode = "STRUCTURE_ONLY" | "STRUCTURE_PLUS_MANAGEMENT" | "FULL";

type CycleRecord = {
  id: string;
  code: string | null;
  name: string;
  nameEn: string | null;
  status: CycleStatus;
  startDate: string | null;
  endDate: string | null;
  sourceCycleId: string | null;
  cloneMode: CloneMode | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sourceCycle: {
    id: string;
    code: string | null;
    name: string;
    nameEn: string | null;
  } | null;
  _count: {
    sessions: number;
    waitingList: number;
    clonedCycles: number;
  };
};

type PaginationMeta = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
};

type CyclesListResponse = {
  ok: boolean;
  data?: CycleRecord[];
  pagination?: PaginationMeta;
  error?: string;
  message?: string;
};

type CycleMutationResponse = {
  ok: boolean;
  data?: CycleRecord;
  error?: string;
  message?: string;
};

type CycleCloneResponse = {
  ok: boolean;
  data?: CycleRecord;
  summary?: {
    clonedCycleId: string;
    clonedSessionsCount: number;
    dateShiftDays: number;
    sourceCycleId: string;
  };
  error?: string;
  message?: string;
};

type CycleFormState = {
  code: string;
  name: string;
  nameEn: string;
  status: CycleStatus;
  startDate: string;
  endDate: string;
  notes: string;
  isActive: boolean;
};

type CloneFormState = {
  newStartDate: string;
  newEndDate: string;
};

type CyclesWorkspaceProps = {
  locale: Locale;
  messages: Messages;
};

const pageSizeOptions = [10, 25, 50];
const cycleStatuses: CycleStatus[] = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"];
const millisecondsPerDay = 24 * 60 * 60 * 1000;

const selectClassName =
  "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent";

function formatDate(locale: Locale, value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium"
  }).format(new Date(value));
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

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function parseDateInput(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function replaceTokens(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template
  );
}

function normalizeOptionalText(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getApiError(payload: { message?: string; error?: string }, fallback: string) {
  return {
    message: payload.message ?? fallback,
    code: payload.error ?? null
  };
}

function buildInitialFormState(): CycleFormState {
  return {
    code: "",
    name: "",
    nameEn: "",
    status: "DRAFT",
    startDate: "",
    endDate: "",
    notes: "",
    isActive: true
  };
}

function buildInitialCloneFormState(cycle: CycleRecord | null): CloneFormState {
  if (!cycle?.startDate || !cycle?.endDate) {
    return {
      newStartDate: "",
      newEndDate: ""
    };
  }

  const sourceStart = parseDateInput(toDateInputValue(cycle.startDate));
  const sourceEnd = parseDateInput(toDateInputValue(cycle.endDate));

  if (!sourceStart || !sourceEnd) {
    return {
      newStartDate: "",
      newEndDate: ""
    };
  }

  const durationDays = Math.round(
    (sourceEnd.getTime() - sourceStart.getTime()) / millisecondsPerDay
  );
  const suggestedStart = new Date(sourceEnd.getTime() + millisecondsPerDay);
  const suggestedEnd = new Date(
    suggestedStart.getTime() + durationDays * millisecondsPerDay
  );

  return {
    newStartDate: formatDateInput(suggestedStart),
    newEndDate: formatDateInput(suggestedEnd)
  };
}

function CycleMetricCard({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function CycleListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-3xl border border-border bg-surface-elevated"
        />
      ))}
    </div>
  );
}

export function CyclesWorkspace({ locale, messages }: CyclesWorkspaceProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listState, setListState] = useState({
    isLoading: true,
    error: null as string | null,
    errorCode: null as string | null,
    data: [] as CycleRecord[],
    pagination: {
      hasNextPage: false,
      hasPreviousPage: false,
      page: 1,
      pageCount: 1,
      pageSize,
      total: 0
    } as PaginationMeta
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<CycleRecord | null>(null);
  const [formState, setFormState] = useState<CycleFormState>(() => buildInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deactivatingCycleId, setDeactivatingCycleId] = useState<string | null>(null);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [cloningCycle, setCloningCycle] = useState<CycleRecord | null>(null);
  const [cloneFormState, setCloneFormState] = useState<CloneFormState>({
    newStartDate: "",
    newEndDate: ""
  });
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneErrorCode, setCloneErrorCode] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCycles() {
      setListState((current) => ({
        ...current,
        isLoading: true,
        error: null,
        errorCode: null
      }));

      const params = new URLSearchParams();
      params.set("includeInactive", includeInactive ? "true" : "false");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (searchTerm) {
        params.set("search", searchTerm);
      }

      try {
        const response = await fetch(`/api/cycles?${params.toString()}`, {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });
        const payload = (await response.json()) as CyclesListResponse;

        if (!response.ok || !payload.ok || !payload.data || !payload.pagination) {
          const apiError = getApiError(payload, messages.cycles.errorBody);
          throw new Error(apiError.code ?? apiError.message);
        }

        setListState({
          isLoading: false,
          error: null,
          errorCode: null,
          data: payload.data,
          pagination: payload.pagination
        });

        if (payload.pagination.page !== page) {
          setPage(payload.pagination.page);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setListState((current) => ({
          ...current,
          isLoading: false,
          error: messages.cycles.errorBody,
          errorCode: error instanceof Error ? error.message : "cycles_request_failed",
          data: []
        }));
      }
    }

    void loadCycles();

    return () => {
      controller.abort();
    };
  }, [includeInactive, messages.cycles.errorBody, page, pageSize, refreshKey, searchTerm]);

  const metrics = useMemo(
    () => [
      {
        label: messages.cycles.labels.active,
        value: listState.data.filter((cycle) => cycle.isActive).length
      },
      {
        label: messages.cycles.labels.sessions,
        value: listState.data.reduce((sum, cycle) => sum + cycle._count.sessions, 0)
      },
      {
        label: messages.cycles.labels.waitingList,
        value: listState.data.reduce((sum, cycle) => sum + cycle._count.waitingList, 0)
      },
      {
        label: messages.cycles.labels.clonedCycles,
        value: listState.data.reduce((sum, cycle) => sum + cycle._count.clonedCycles, 0)
      }
    ],
    [listState.data, messages.cycles.labels]
  );

  const clonePreview = useMemo(() => {
    if (!cloningCycle) {
      return null;
    }

    const sourceStartDate = parseDateInput(toDateInputValue(cloningCycle.startDate));
    const targetStartDate = parseDateInput(cloneFormState.newStartDate);
    const targetEndDate = parseDateInput(cloneFormState.newEndDate);
    const dateShiftDays =
      sourceStartDate && targetStartDate
        ? Math.round((targetStartDate.getTime() - sourceStartDate.getTime()) / millisecondsPerDay)
        : null;

    return {
      sourceStartDate,
      targetStartDate,
      targetEndDate,
      dateShiftDays,
      sessionsCount: cloningCycle._count.sessions
    };
  }, [cloneFormState.newEndDate, cloneFormState.newStartDate, cloningCycle]);

  function openCreateModal() {
    setEditingCycle(null);
    setFormState(buildInitialFormState());
    setFormError(null);
    setFormErrorCode(null);
    setIsFormOpen(true);
  }

  function openEditModal(cycle: CycleRecord) {
    setEditingCycle(cycle);
    setFormState({
      code: cycle.code ?? "",
      name: cycle.name,
      nameEn: cycle.nameEn ?? "",
      status: cycle.status,
      startDate: toDateInputValue(cycle.startDate),
      endDate: toDateInputValue(cycle.endDate),
      notes: cycle.notes ?? "",
      isActive: cycle.isActive
    });
    setFormError(null);
    setFormErrorCode(null);
    setIsFormOpen(true);
  }

  function closeFormModal() {
    setIsFormOpen(false);
    setEditingCycle(null);
    setFormError(null);
    setFormErrorCode(null);
    setFormState(buildInitialFormState());
  }

  function openCloneModal(cycle: CycleRecord) {
    setCloningCycle(cycle);
    setCloneFormState(buildInitialCloneFormState(cycle));
    setCloneError(null);
    setCloneErrorCode(null);
    setIsCloneOpen(true);
  }

  function closeCloneModal() {
    setIsCloneOpen(false);
    setCloningCycle(null);
    setCloneFormState({
      newStartDate: "",
      newEndDate: ""
    });
    setCloneError(null);
    setCloneErrorCode(null);
  }

  async function submitForm() {
    const name = normalizeOptionalText(formState.name);
    const nameEn = normalizeOptionalText(formState.nameEn);

    if (!name && !nameEn) {
      setFormError(messages.cycles.form.nameRequired);
      setFormErrorCode(null);
      return;
    }

    if (!formState.startDate || !formState.endDate) {
      setFormError(messages.cycles.form.dateRangeInvalid);
      setFormErrorCode(null);
      return;
    }

    if (new Date(formState.startDate).getTime() >= new Date(formState.endDate).getTime()) {
      setFormError(messages.cycles.form.dateRangeInvalid);
      setFormErrorCode(null);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormErrorCode(null);

    const payload = {
      code: normalizeOptionalText(formState.code),
      name,
      nameEn,
      status: formState.status,
      startDate: formState.startDate,
      endDate: formState.endDate,
      notes: normalizeOptionalText(formState.notes),
      isActive: formState.isActive
    };

    try {
      const endpoint = editingCycle ? `/api/cycles/${editingCycle.id}` : "/api/cycles";
      const method = editingCycle ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as CycleMutationResponse;

      if (!response.ok || !result.ok || !result.data) {
        const apiError = getApiError(result, messages.cycles.errorBody);
        setFormError(apiError.message);
        setFormErrorCode(apiError.code);
        return;
      }

      closeFormModal();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(messages.cycles.errorBody);
      setFormErrorCode(error instanceof Error ? error.message : "cycle_mutation_failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deactivateCycle(cycle: CycleRecord) {
    const confirmed = window.confirm(
      `${messages.cycles.actions.deactivate}: ${getLocalizedName(cycle, locale)}?`
    );

    if (!confirmed) {
      return;
    }

    setDeactivatingCycleId(cycle.id);

    try {
      const response = await fetch(`/api/cycles/${cycle.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json()) as CycleMutationResponse;

      if (!response.ok || !payload.ok) {
        const apiError = getApiError(payload, messages.cycles.errorBody);
        window.alert(apiError.message);
        return;
      }

      setRefreshKey((current) => current + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : messages.cycles.errorBody);
    } finally {
      setDeactivatingCycleId(null);
    }
  }

  async function submitClone() {
    if (!cloningCycle) {
      return;
    }

    const targetStartDate = parseDateInput(cloneFormState.newStartDate);
    const targetEndDate = parseDateInput(cloneFormState.newEndDate);

    if (!targetStartDate || !targetEndDate) {
      setCloneError(messages.cycles.cloneFlow.dateRangeInvalid);
      setCloneErrorCode(null);
      return;
    }

    if (targetStartDate.getTime() >= targetEndDate.getTime()) {
      setCloneError(messages.cycles.cloneFlow.dateRangeInvalid);
      setCloneErrorCode(null);
      return;
    }

    setIsCloning(true);
    setCloneError(null);
    setCloneErrorCode(null);

    try {
      const response = await fetch(`/api/cycles/${cloningCycle.id}/clone`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          newStartDate: cloneFormState.newStartDate,
          newEndDate: cloneFormState.newEndDate
        })
      });
      const payload = (await response.json()) as CycleCloneResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        const apiError = getApiError(payload, messages.cycles.errorBody);
        setCloneError(apiError.message);
        setCloneErrorCode(apiError.code);
        return;
      }

      closeCloneModal();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setCloneError(messages.cycles.errorBody);
      setCloneErrorCode(error instanceof Error ? error.message : "cycle_clone_failed");
    } finally {
      setIsCloning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{messages.nav.cycles}</Badge>
          </div>
          <CardTitle className="text-3xl">{messages.cycles.title}</CardTitle>
          <CardDescription className="text-base">{messages.cycles.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-3xl text-sm leading-7 text-text-secondary">
            {messages.cycles.description}
          </p>

          <div className="grid gap-4 xl:grid-cols-[2fr_repeat(2,1fr)]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="cycles-search">
                {messages.cycles.searchLabel}
              </label>
              <Input
                id="cycles-search"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setPage(1);
                }}
                placeholder={messages.cycles.searchPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="cycles-page-size">
                {messages.cycles.pagination.pageSize}
              </label>
              <select
                id="cycles-page-size"
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
              <label className="text-sm font-medium text-text-primary" htmlFor="cycles-page-number">
                {messages.cycles.pagination.summary}
              </label>
              <Input
                id="cycles-page-number"
                value={`${listState.pagination.page} / ${listState.pagination.pageCount}`}
                readOnly
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={openCreateModal}>
              {messages.cycles.create}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIncludeInactive((current) => !current);
                setPage(1);
              }}
            >
              {includeInactive ? messages.cycles.showActiveOnly : messages.cycles.showInactive}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              {messages.cycles.reload}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.cycles.snapshotTitle}</CardTitle>
          <CardDescription>{messages.cycles.snapshotBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <CycleMetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.cycles.listTitle}</CardTitle>
          <CardDescription>
            {replaceTokens(messages.cycles.listBody, { count: listState.data.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {listState.isLoading ? <CycleListSkeleton /> : null}

          {!listState.isLoading && listState.error ? (
            <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-5 py-5">
              <h3 className="text-lg font-semibold text-text-primary">{messages.cycles.errorTitle}</h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">{listState.error}</p>
              {listState.errorCode ? (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-danger">{listState.errorCode}</p>
              ) : null}
            </div>
          ) : null}

          {!listState.isLoading && !listState.error && listState.data.length === 0 ? (
            <div className="rounded-3xl border border-border bg-surface-elevated px-5 py-5">
              <h3 className="text-lg font-semibold text-text-primary">{messages.cycles.emptyTitle}</h3>
              <p className="mt-2 text-sm leading-7 text-text-secondary">{messages.cycles.emptyBody}</p>
            </div>
          ) : null}

          {!listState.isLoading && !listState.error && listState.data.length > 0 ? (
            <>
              <div className="space-y-3">
                {listState.data.map((cycle) => {
                  const localizedName = getLocalizedName(cycle, locale);
                  const alternateName = getAlternateLocalizedName(cycle, locale);
                  const isDeactivating = deactivatingCycleId === cycle.id;

                  return (
                    <div
                      key={cycle.id}
                      className="rounded-3xl border border-border bg-surface-elevated px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="accent">{messages.cycles.statuses[cycle.status]}</Badge>
                          <Badge>{cycle.isActive ? messages.cycles.labels.active : messages.cycles.labels.inactive}</Badge>
                          {cycle.code ? <Badge>{`${messages.cycles.labels.code}: ${cycle.code}`}</Badge> : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/cycles/${cycle.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-2xl bg-surface-elevated px-3 text-sm font-medium text-text-primary ring-1 ring-border transition-colors hover:bg-surface"
                          >
                            {messages.cycles.actions.view}
                          </Link>
                          <Button variant="secondary" size="sm" onClick={() => openEditModal(cycle)}>
                            {messages.cycles.actions.edit}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openCloneModal(cycle)}
                            disabled={!cycle.isActive || isDeactivating}
                          >
                            {messages.cycles.actions.clone}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void deactivateCycle(cycle)}
                            disabled={isDeactivating || !cycle.isActive}
                          >
                            {isDeactivating
                              ? messages.cycles.actions.deactivating
                              : messages.cycles.actions.deactivate}
                          </Button>
                        </div>
                      </div>

                      <h3 className="mt-4 text-lg font-semibold text-text-primary">{localizedName}</h3>
                      {alternateName ? (
                        <p className="mt-1 text-sm text-text-secondary">{alternateName}</p>
                      ) : null}

                      <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
                        <p>
                          {messages.cycles.labels.dateRange}: {formatDate(locale, cycle.startDate)} -{" "}
                          {formatDate(locale, cycle.endDate)}
                        </p>
                        <p>
                          {messages.cycles.labels.sessions}: {cycle._count.sessions}
                        </p>
                        <p>
                          {messages.cycles.labels.waitingList}: {cycle._count.waitingList}
                        </p>
                        <p>
                          {messages.cycles.labels.clonedCycles}: {cycle._count.clonedCycles}
                        </p>
                        <p>
                          {messages.cycles.labels.updatedAt}: {formatDateTime(locale, cycle.updatedAt)}
                        </p>
                        <p>
                          {messages.cycles.labels.sourceCycle}: {cycle.sourceCycle ? getLocalizedName(cycle.sourceCycle, locale) : "-"}
                        </p>
                        <p>
                          {messages.cycles.labels.cloneMode}: {cycle.cloneMode ? messages.cycles.cloneModes[cycle.cloneMode] : "-"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface-elevated px-4 py-3">
                <p className="text-sm text-text-secondary">
                  {replaceTokens(messages.cycles.pagination.summary, {
                    page: listState.pagination.page,
                    pageCount: listState.pagination.pageCount
                  })}
                </p>
                <p className="text-sm text-text-secondary">
                  {replaceTokens(messages.cycles.pagination.total, {
                    total: listState.pagination.total
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={!listState.pagination.hasPreviousPage}
                  >
                    {messages.cycles.pagination.previous}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!listState.pagination.hasNextPage}
                  >
                    {messages.cycles.pagination.next}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {isFormOpen ? (
        <ModalOverlay>
          <Card className="panel max-h-[90vh] w-full max-w-3xl overflow-y-auto border-transparent">
            <CardHeader>
              <CardTitle>
                {editingCycle ? messages.cycles.form.editTitle : messages.cycles.form.createTitle}
              </CardTitle>
              <CardDescription>{messages.cycles.form.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="cycle-code">
                    {messages.cycles.form.code}
                  </label>
                  <Input
                    id="cycle-code"
                    value={formState.code}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, code: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="cycle-status">
                    {messages.cycles.form.status}
                  </label>
                  <select
                    id="cycle-status"
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        status: event.target.value as CycleStatus
                      }))
                    }
                    className={selectClassName}
                  >
                    {cycleStatuses.map((status) => (
                      <option key={status} value={status}>
                        {messages.cycles.statuses[status]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="cycle-name-ar">
                    {messages.cycles.form.nameAr}
                  </label>
                  <Input
                    id="cycle-name-ar"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="cycle-name-en">
                    {messages.cycles.form.nameEn}
                  </label>
                  <Input
                    id="cycle-name-en"
                    value={formState.nameEn}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, nameEn: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="cycle-start-date">
                    {messages.cycles.form.startDate}
                  </label>
                  <Input
                    id="cycle-start-date"
                    type="date"
                    value={formState.startDate}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, startDate: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="cycle-end-date">
                    {messages.cycles.form.endDate}
                  </label>
                  <Input
                    id="cycle-end-date"
                    type="date"
                    value={formState.endDate}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, endDate: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary" htmlFor="cycle-notes">
                  {messages.cycles.form.notes}
                </label>
                <textarea
                  id="cycle-notes"
                  rows={4}
                  className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-text-primary" htmlFor="cycle-active">
                <input
                  id="cycle-active"
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                {messages.cycles.form.isActive}
              </label>

              {formError ? (
                <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4">
                  <p className="text-sm text-danger">{formError}</p>
                  {formErrorCode ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-danger">{formErrorCode}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={closeFormModal}>
                  {messages.cycles.form.cancel}
                </Button>
                <Button onClick={() => void submitForm()} disabled={isSubmitting}>
                  {isSubmitting
                    ? messages.cycles.form.submitting
                    : editingCycle
                      ? messages.cycles.form.submitEdit
                      : messages.cycles.form.submitCreate}
                </Button>
              </div>
            </CardContent>
          </Card>
        </ModalOverlay>
      ) : null}

      {isCloneOpen && cloningCycle ? (
        <ModalOverlay>
          <Card className="panel max-h-[90vh] w-full max-w-2xl overflow-y-auto border-transparent">
            <CardHeader>
              <CardTitle>{messages.cycles.cloneFlow.title}</CardTitle>
              <CardDescription>{messages.cycles.cloneFlow.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
                <p className="text-sm font-medium text-text-primary">
                  {messages.cycles.cloneFlow.sourceCycle}: {getLocalizedName(cloningCycle, locale)}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {messages.cycles.cloneFlow.sourceRange}: {formatDate(locale, cloningCycle.startDate)} -{" "}
                  {formatDate(locale, cloningCycle.endDate)}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="clone-start-date">
                    {messages.cycles.cloneFlow.newStartDate}
                  </label>
                  <Input
                    id="clone-start-date"
                    type="date"
                    value={cloneFormState.newStartDate}
                    onChange={(event) =>
                      setCloneFormState((current) => ({
                        ...current,
                        newStartDate: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="clone-end-date">
                    {messages.cycles.cloneFlow.newEndDate}
                  </label>
                  <Input
                    id="clone-end-date"
                    type="date"
                    value={cloneFormState.newEndDate}
                    onChange={(event) =>
                      setCloneFormState((current) => ({
                        ...current,
                        newEndDate: event.target.value
                      }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {messages.cycles.cloneFlow.previewTitle}
                </h3>
                <div className="mt-3 grid gap-2 text-sm text-text-secondary">
                  <p>
                    {messages.cycles.cloneFlow.sessionsCount}: {clonePreview?.sessionsCount ?? 0}
                  </p>
                  <p>
                    {messages.cycles.cloneFlow.targetRange}:{" "}
                    {clonePreview?.targetStartDate && clonePreview?.targetEndDate
                      ? `${formatDate(locale, clonePreview.targetStartDate.toISOString())} - ${formatDate(locale, clonePreview.targetEndDate.toISOString())}`
                      : "-"}
                  </p>
                  <p>
                    {messages.cycles.cloneFlow.dateShiftDays}:{" "}
                    {clonePreview?.dateShiftDays === null || clonePreview?.dateShiftDays === undefined
                      ? "-"
                      : replaceTokens(messages.cycles.cloneFlow.daysValue, {
                          days: clonePreview.dateShiftDays
                        })}
                  </p>
                </div>
              </div>

              {cloneError ? (
                <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4">
                  <p className="text-sm text-danger">{cloneError}</p>
                  {cloneErrorCode ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-danger">{cloneErrorCode}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={closeCloneModal}>
                  {messages.cycles.cloneFlow.cancel}
                </Button>
                <Button onClick={() => void submitClone()} disabled={isCloning}>
                  {isCloning ? messages.cycles.actions.cloning : messages.cycles.cloneFlow.submit}
                </Button>
              </div>
            </CardContent>
          </Card>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
