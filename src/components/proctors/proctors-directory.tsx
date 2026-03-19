"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

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
import type { Locale, Messages } from "@/lib/i18n";
import {
  getAlternateLocalizedName,
  getLocalizedName
} from "@/lib/i18n/presentation";
import { cn } from "@/lib/utils";

type ProctorSource = "SPHINX" | "UNIVERSITY" | "EXTERNAL";
type BlockStatus = "CLEAR" | "TEMPORARY" | "PERMANENT";
type PreferredLanguage = "AR" | "EN" | null;
type ExportFormat = "csv" | "excel";
type ExportStatus = "active" | "inactive" | "all";

type GovernorateOption = {
  id: string;
  name: string;
  nameEn: string | null;
};

type ProctorRecord = {
  id: string;
  name: string;
  nameEn: string | null;
  phone: string;
  nationalId: string | null;
  email: string | null;
  source: ProctorSource;
  organization: string | null;
  branch: string | null;
  governorateId: string | null;
  averageRating: string;
  totalSessions: number;
  blockStatus: BlockStatus;
  blockEndsAt: string | null;
  preferredLanguage: PreferredLanguage;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  governorate: {
    id: string;
    name: string;
    nameEn: string | null;
    code: string | null;
  } | null;
  _count: {
    assignments: number;
    waitingListEntries: number;
    evaluationsReceived: number;
    blocks: number;
  };
};

type ProctorsResponse = {
  ok: boolean;
  data?: ProctorRecord[];
  error?: string;
  message?: string;
};

type ProctorDetailResponse = {
  ok: boolean;
  data?: ProctorRecord;
  error?: string;
  message?: string;
};

type ProctorsImportTemplateResponse = {
  ok: boolean;
  sampleCsv?: string;
  columns?: string[];
};

type ProctorsImportResponse = {
  ok: boolean;
  summary?: {
    total: number;
    success: number;
    failed: number;
    created: number;
    reused: number;
  };
  errors?: Array<{
    row: number;
    error: string;
    message: string;
    details?: Record<string, unknown> | null;
  }>;
  error?: string;
  message?: string;
};

type LocationsResponse = {
  ok: boolean;
  data?: GovernorateOption[];
  error?: string;
  message?: string;
};

type ProctorsDirectoryProps = {
  locale: Locale;
  messages: Messages;
};

const selectClassName =
  "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent";

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-3xl border border-border bg-surface-elevated"
        />
      ))}
    </div>
  );
}

function formatDate(locale: Locale, value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toPreferredLanguageLabel(
  locale: Locale,
  messages: Messages,
  value: PreferredLanguage
) {
  if (value === "AR") {
    return messages.common.arabic;
  }

  if (value === "EN") {
    return messages.common.english;
  }

  return locale === "ar" ? "-" : "-";
}

function DetailRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </p>
      <div className="mt-2 text-sm leading-7 text-text-primary">{value ?? "-"}</div>
    </div>
  );
}

function MetricCard({
  label,
  value
}: {
  label: string;
  value: number | string;
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

export function ProctorsDirectory({ locale, messages }: ProctorsDirectoryProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | ProctorSource>("");
  const [blockStatusFilter, setBlockStatusFilter] = useState<"" | BlockStatus>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listState, setListState] = useState({
    isLoading: true,
    error: null as string | null,
    errorCode: null as string | null,
    data: [] as ProctorRecord[]
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState({
    isLoading: false,
    error: null as string | null,
    errorCode: null as string | null,
    data: null as ProctorRecord | null
  });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ProctorsImportResponse | null>(null);
  const [importSample, setImportSample] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportStatus, setExportStatus] = useState<ExportStatus>("active");
  const [exportGovernorateId, setExportGovernorateId] = useState("");
  const [governorates, setGovernorates] = useState<GovernorateOption[]>([]);
  const [isGovernoratesLoading, setIsGovernoratesLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadList() {
      setListState((current) => ({
        ...current,
        isLoading: true,
        error: null,
        errorCode: null
      }));

      const params = new URLSearchParams();
      params.set("includeInactive", includeInactive ? "true" : "false");

      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      if (sourceFilter) {
        params.set("source", sourceFilter);
      }

      if (blockStatusFilter) {
        params.set("blockStatus", blockStatusFilter);
      }

      try {
        const response = await fetch(`/api/proctors?${params.toString()}`, {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });
        const payload = (await response.json()) as ProctorsResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.message ?? payload.error ?? "proctors_request_failed");
        }

        const records = payload.data;

        setListState({
          isLoading: false,
          error: null,
          errorCode: null,
          data: records
        });
        setSelectedId((current) => {
          if (current && records.some((record) => record.id === current)) {
            return current;
          }

          return records[0]?.id ?? null;
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setListState({
          isLoading: false,
          error: messages.proctors.errorBody,
          errorCode: error instanceof Error ? error.message : "proctors_request_failed",
          data: []
        });
        setSelectedId(null);
      }
    }

    void loadList();

    return () => {
      controller.abort();
    };
  }, [
    blockStatusFilter,
    includeInactive,
    messages.proctors.errorBody,
    refreshKey,
    searchTerm,
    sourceFilter
  ]);

  useEffect(() => {
    if (!selectedId) {
      setDetailState({
        isLoading: false,
        error: null,
        errorCode: null,
        data: null
      });
      return;
    }

    const controller = new AbortController();

    async function loadDetail() {
      setDetailState((current) => ({
        ...current,
        isLoading: true,
        error: null,
        errorCode: null
      }));

      try {
        const response = await fetch(
          `/api/proctors/${selectedId}?includeInactive=${includeInactive ? "true" : "false"}`,
          {
            method: "GET",
            credentials: "same-origin",
            headers: {
              Accept: "application/json"
            },
            signal: controller.signal
          }
        );
        const payload = (await response.json()) as ProctorDetailResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.message ?? payload.error ?? "proctor_detail_failed");
        }

        setDetailState({
          isLoading: false,
          error: null,
          errorCode: null,
          data: payload.data
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setDetailState({
          isLoading: false,
          error: messages.proctors.detailErrorBody,
          errorCode: error instanceof Error ? error.message : "proctor_detail_failed",
          data: null
        });
      }
    }

    void loadDetail();

    return () => {
      controller.abort();
    };
  }, [includeInactive, messages.proctors.detailErrorBody, selectedId]);

  async function openImportModal() {
    setIsImportOpen(true);
    setImportError(null);

    if (importSample) {
      return;
    }

    try {
      const response = await fetch("/api/proctors/import", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      const payload = (await response.json()) as ProctorsImportTemplateResponse;

      if (response.ok && payload.ok && payload.sampleCsv) {
        setImportSample(payload.sampleCsv);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function handleImportSubmit() {
    if (!selectedFile) {
      setImportError(messages.proctors.importFlow.missingFile);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setImportError(messages.proctors.importFlow.unsupportedFile);
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/proctors/import", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      const payload = (await response.json()) as ProctorsImportResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? payload.error ?? "proctors_import_failed");
      }

      setImportResult(payload);
      setSelectedFile(null);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      console.error(error);
      setImportError(
        error instanceof Error ? error.message : messages.proctors.importFlow.submit
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function loadGovernorates() {
    if (governorates.length > 0 || isGovernoratesLoading) {
      return;
    }

    setIsGovernoratesLoading(true);

    try {
      const response = await fetch("/api/locations?includeInactive=false", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json()) as LocationsResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.message ?? payload.error ?? "governorates_request_failed");
      }

      setGovernorates(
        payload.data.map((governorate) => ({
          id: governorate.id,
          name: governorate.name,
          nameEn: governorate.nameEn
        }))
      );
    } catch (error) {
      console.error(error);
    } finally {
      setIsGovernoratesLoading(false);
    }
  }

  async function openExportModal() {
    setIsExportOpen(true);
    setExportError(null);
    await loadGovernorates();
  }

  async function handleExportSubmit() {
    setIsExporting(true);
    setExportError(null);

    try {
      const params = new URLSearchParams();
      params.set("format", exportFormat);
      params.set("status", exportStatus);
      params.set("locale", locale);

      if (exportGovernorateId) {
        params.set("governorateId", exportGovernorateId);
      }

      const response = await fetch(`/api/proctors/export?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin"
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
        };
        throw new Error(payload.message ?? payload.error ?? "proctors_export_failed");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("content-disposition");
      const fileNameMatch = disposition?.match(/filename=\"([^\"]+)\"/);

      anchor.href = downloadUrl;
      anchor.download =
        fileNameMatch?.[1] ??
        (exportFormat === "excel" ? "proctors-export.xls" : "proctors-export.csv");
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setIsExportOpen(false);
    } catch (error) {
      console.error(error);
      setExportError(
        error instanceof Error ? error.message : messages.proctors.exportFlow.submit
      );
    } finally {
      setIsExporting(false);
    }
  }

  const selectedProctor = detailState.data;
  const listCount = listState.data.length;
  const metrics = [
    {
      label: messages.proctors.labels.sessions,
      value: listState.data.reduce((sum, proctor) => sum + proctor.totalSessions, 0)
    },
    {
      label: messages.proctors.labels.assignments,
      value: listState.data.reduce((sum, proctor) => sum + proctor._count.assignments, 0)
    },
    {
      label: messages.proctors.labels.waitingList,
      value: listState.data.reduce((sum, proctor) => sum + proctor._count.waitingListEntries, 0)
    },
    {
      label: messages.proctors.labels.blocks,
      value: listState.data.reduce((sum, proctor) => sum + proctor._count.blocks, 0)
    }
  ];

  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{messages.nav.proctors}</Badge>
          </div>
          <CardTitle className="text-3xl">{messages.proctors.title}</CardTitle>
          <CardDescription className="text-base">
            {messages.proctors.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-3xl text-sm leading-7 text-text-secondary">
            {messages.proctors.description}
          </p>
          <div className="grid gap-4 xl:grid-cols-[2fr_repeat(2,1fr)]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctors-search">
                {messages.proctors.searchLabel}
              </label>
              <Input
                id="proctors-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={messages.proctors.searchPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctors-source">
                {messages.proctors.filters.source}
              </label>
              <select
                id="proctors-source"
                value={sourceFilter}
                onChange={(event) =>
                  setSourceFilter(event.target.value as "" | ProctorSource)
                }
                className={selectClassName}
              >
                <option value="">{messages.proctors.filters.allSources}</option>
                <option value="SPHINX">{messages.proctors.sources.SPHINX}</option>
                <option value="UNIVERSITY">{messages.proctors.sources.UNIVERSITY}</option>
                <option value="EXTERNAL">{messages.proctors.sources.EXTERNAL}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-text-primary"
                htmlFor="proctors-block-status"
              >
                {messages.proctors.filters.blockStatus}
              </label>
              <select
                id="proctors-block-status"
                value={blockStatusFilter}
                onChange={(event) =>
                  setBlockStatusFilter(event.target.value as "" | BlockStatus)
                }
                className={selectClassName}
              >
                <option value="">{messages.proctors.filters.allBlockStatuses}</option>
                <option value="CLEAR">{messages.proctors.blockStatuses.CLEAR}</option>
                <option value="TEMPORARY">{messages.proctors.blockStatuses.TEMPORARY}</option>
                <option value="PERMANENT">{messages.proctors.blockStatuses.PERMANENT}</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={() => void openImportModal()}>
              {messages.proctors.import}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void openExportModal()}>
              {messages.proctors.export}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIncludeInactive((current) => !current)}
            >
              {includeInactive
                ? messages.proctors.showActiveOnly
                : messages.proctors.showInactive}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              {messages.proctors.reload}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.snapshotTitle}</CardTitle>
          <CardDescription>{messages.proctors.snapshotBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>{messages.proctors.listTitle}</CardTitle>
            <CardDescription>
              {messages.proctors.listBody.replace("{count}", String(listCount))}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {listState.isLoading ? <DetailSkeleton /> : null}

            {!listState.isLoading && listState.error ? (
              <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-5 py-5">
                <h3 className="text-lg font-semibold text-text-primary">
                  {messages.proctors.errorTitle}
                </h3>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  {listState.error}
                </p>
                {listState.errorCode ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-danger">
                    {listState.errorCode}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!listState.isLoading && !listState.error && listState.data.length === 0 ? (
              <div className="rounded-3xl border border-border bg-surface-elevated px-5 py-5">
                <h3 className="text-lg font-semibold text-text-primary">
                  {messages.proctors.emptyTitle}
                </h3>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  {messages.proctors.emptyBody}
                </p>
              </div>
            ) : null}

            {!listState.isLoading && !listState.error && listState.data.length > 0 ? (
              <div className="space-y-3">
                {listState.data.map((proctor) => {
                  const label = getLocalizedName(proctor, locale);
                  const alternate = getAlternateLocalizedName(proctor, locale);
                  const isSelected = proctor.id === selectedId;

                  return (
                    <button
                      key={proctor.id}
                      type="button"
                      onClick={() => setSelectedId(proctor.id)}
                      className={cn(
                        "w-full rounded-3xl border px-4 py-4 text-start transition-colors",
                        isSelected
                          ? "border-accent bg-surface-elevated"
                          : "border-border bg-surface hover:bg-surface-elevated"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="accent">
                          {messages.proctors.sources[proctor.source]}
                        </Badge>
                        <Badge>
                          {proctor.isActive
                            ? messages.proctors.labels.active
                            : messages.proctors.labels.inactive}
                        </Badge>
                        <Badge>
                          {messages.proctors.blockStatuses[proctor.blockStatus]}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-text-primary">{label}</h3>
                      {alternate ? (
                        <p className="mt-1 text-sm text-text-secondary">{alternate}</p>
                      ) : null}
                      <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                        <p>
                          {messages.proctors.labels.phone}: {proctor.phone}
                        </p>
                        <p>
                          {messages.proctors.labels.sessions}: {proctor.totalSessions}
                        </p>
                        <p>
                          {messages.proctors.labels.organization}: {proctor.organization ?? "-"}
                        </p>
                        <p>
                          {messages.proctors.labels.governorate}:{" "}
                          {proctor.governorate
                            ? getLocalizedName(proctor.governorate, locale)
                            : "-"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{messages.proctors.detailTitle}</CardTitle>
            <CardDescription>{messages.proctors.detailBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailState.isLoading ? <DetailSkeleton /> : null}

            {!detailState.isLoading && detailState.error ? (
              <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-5 py-5">
                <h3 className="text-lg font-semibold text-text-primary">
                  {messages.proctors.detailErrorTitle}
                </h3>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  {detailState.error}
                </p>
                {detailState.errorCode ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-danger">
                    {detailState.errorCode}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!detailState.isLoading && !detailState.error && !selectedProctor ? (
              <div className="rounded-3xl border border-border bg-surface-elevated px-5 py-5">
                <h3 className="text-lg font-semibold text-text-primary">
                  {messages.proctors.detailEmptyTitle}
                </h3>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  {messages.proctors.detailEmptyBody}
                </p>
              </div>
            ) : null}

            {!detailState.isLoading && !detailState.error && selectedProctor ? (
              <>
                <div className="rounded-3xl border border-border bg-surface-elevated px-5 py-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="accent">
                      {messages.proctors.sources[selectedProctor.source]}
                    </Badge>
                    <Badge>
                      {selectedProctor.isActive
                        ? messages.proctors.labels.active
                        : messages.proctors.labels.inactive}
                    </Badge>
                    <Badge>
                      {messages.proctors.blockStatuses[selectedProctor.blockStatus]}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold text-text-primary">
                    {getLocalizedName(selectedProctor, locale)}
                  </h3>
                  {getAlternateLocalizedName(selectedProctor, locale) ? (
                    <p className="mt-2 text-sm text-text-secondary">
                      {getAlternateLocalizedName(selectedProctor, locale)}
                    </p>
                  ) : null}
                  <p className="mt-4 text-sm leading-7 text-text-secondary">
                    {selectedProctor.notes ?? messages.proctors.noNotes}
                  </p>
                  <div className="mt-4">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/proctors/${selectedProctor.id}`)}
                    >
                      {messages.proctors.viewProfile}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow
                    label={messages.proctors.labels.phone}
                    value={selectedProctor.phone}
                  />
                  <DetailRow
                    label={messages.proctors.labels.email}
                    value={selectedProctor.email ?? "-"}
                  />
                  <DetailRow
                    label={messages.proctors.labels.nationalId}
                    value={selectedProctor.nationalId ?? "-"}
                  />
                  <DetailRow
                    label={messages.proctors.labels.organization}
                    value={selectedProctor.organization ?? "-"}
                  />
                  <DetailRow
                    label={messages.proctors.labels.branch}
                    value={selectedProctor.branch ?? "-"}
                  />
                  <DetailRow
                    label={messages.proctors.labels.governorate}
                    value={
                      selectedProctor.governorate
                        ? getLocalizedName(selectedProctor.governorate, locale)
                        : "-"
                    }
                  />
                  <DetailRow
                    label={messages.proctors.labels.preferredLanguage}
                    value={toPreferredLanguageLabel(
                      locale,
                      messages,
                      selectedProctor.preferredLanguage
                    )}
                  />
                  <DetailRow
                    label={messages.proctors.labels.rating}
                    value={selectedProctor.averageRating}
                  />
                  <DetailRow
                    label={messages.proctors.labels.sessions}
                    value={selectedProctor.totalSessions}
                  />
                  <DetailRow
                    label={messages.proctors.labels.assignments}
                    value={selectedProctor._count.assignments}
                  />
                  <DetailRow
                    label={messages.proctors.labels.waitingList}
                    value={selectedProctor._count.waitingListEntries}
                  />
                  <DetailRow
                    label={messages.proctors.labels.blocks}
                    value={selectedProctor._count.blocks}
                  />
                  <DetailRow
                    label={messages.proctors.labels.blockEndsAt}
                    value={formatDate(locale, selectedProctor.blockEndsAt) ?? "-"}
                  />
                  <DetailRow
                    label={messages.proctors.labels.updatedAt}
                    value={formatDate(locale, selectedProctor.updatedAt) ?? "-"}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {isImportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm">
          <Card className="panel max-h-[90vh] w-full max-w-4xl overflow-y-auto border-transparent">
            <CardHeader>
              <CardTitle>{messages.proctors.importFlow.title}</CardTitle>
              <CardDescription>{messages.proctors.importFlow.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="proctors-import-file"
                >
                  {messages.proctors.importFlow.fileLabel}
                </label>
                <Input
                  id="proctors-import-file"
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
                  {messages.proctors.importFlow.sampleTitle}
                </p>
                <p className="mt-2 text-sm leading-7 text-text-secondary">
                  {messages.proctors.importFlow.sampleBody}
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
                    {messages.proctors.importFlow.resultTitle}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                      label={messages.proctors.importFlow.total}
                      value={importResult.summary.total}
                    />
                    <MetricCard
                      label={messages.proctors.importFlow.success}
                      value={importResult.summary.success}
                    />
                    <MetricCard
                      label={messages.proctors.importFlow.failed}
                      value={importResult.summary.failed}
                    />
                    <MetricCard
                      label={messages.proctors.importFlow.created}
                      value={importResult.summary.created}
                    />
                    <MetricCard
                      label={messages.proctors.importFlow.reused}
                      value={importResult.summary.reused}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {messages.proctors.importFlow.errorsTitle}
                    </p>
                    {importResult.errors && importResult.errors.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {importResult.errors.map((rowError) => (
                          <div
                            key={`${rowError.row}-${rowError.error}`}
                            className="rounded-2xl border border-danger/30 bg-background px-4 py-4"
                          >
                            <p className="text-sm font-semibold text-text-primary">
                              {messages.proctors.importFlow.row} {rowError.row}
                            </p>
                            <p className="mt-1 text-sm text-danger">{rowError.message}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-secondary">
                              {rowError.error}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-text-secondary">
                        {messages.proctors.importFlow.noErrors}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsImportOpen(false);
                    setImportError(null);
                  }}
                >
                  {messages.proctors.importFlow.close}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedFile(null);
                    setImportResult(null);
                    setImportError(null);
                    setIsImportOpen(false);
                  }}
                >
                  {messages.proctors.importFlow.cancel}
                </Button>
                <Button onClick={() => void handleImportSubmit()} disabled={isImporting}>
                  {isImporting
                    ? messages.proctors.importFlow.submitting
                    : messages.proctors.importFlow.submit}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isExportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm">
          <Card className="panel w-full max-w-2xl border-transparent">
            <CardHeader>
              <CardTitle>{messages.proctors.exportFlow.title}</CardTitle>
              <CardDescription>{messages.proctors.exportFlow.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="export-format">
                    {messages.proctors.exportFlow.formatLabel}
                  </label>
                  <select
                    id="export-format"
                    value={exportFormat}
                    onChange={(event) =>
                      setExportFormat(event.target.value as ExportFormat)
                    }
                    className={selectClassName}
                  >
                    <option value="csv">{messages.proctors.exportFlow.csv}</option>
                    <option value="excel">{messages.proctors.exportFlow.excel}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary" htmlFor="export-status">
                    {messages.proctors.exportFlow.statusLabel}
                  </label>
                  <select
                    id="export-status"
                    value={exportStatus}
                    onChange={(event) =>
                      setExportStatus(event.target.value as ExportStatus)
                    }
                    className={selectClassName}
                  >
                    <option value="active">{messages.proctors.exportFlow.activeOnly}</option>
                    <option value="inactive">{messages.proctors.exportFlow.inactiveOnly}</option>
                    <option value="all">{messages.proctors.exportFlow.allStatuses}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="export-governorate"
                >
                  {messages.proctors.exportFlow.governorateLabel}
                </label>
                <select
                  id="export-governorate"
                  value={exportGovernorateId}
                  onChange={(event) => setExportGovernorateId(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">{messages.proctors.exportFlow.allGovernorates}</option>
                  {governorates.map((governorate) => (
                    <option key={governorate.id} value={governorate.id}>
                      {getLocalizedName(governorate, locale)}
                    </option>
                  ))}
                </select>
                {isGovernoratesLoading ? (
                  <p className="text-xs text-text-secondary">
                    {messages.proctors.exportFlow.loadingGovernorates}
                  </p>
                ) : null}
              </div>

              {exportError ? (
                <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
                  {exportError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsExportOpen(false);
                    setExportError(null);
                  }}
                >
                  {messages.proctors.exportFlow.close}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setExportGovernorateId("");
                    setExportStatus("active");
                    setExportFormat("csv");
                    setExportError(null);
                    setIsExportOpen(false);
                  }}
                >
                  {messages.proctors.exportFlow.cancel}
                </Button>
                <Button onClick={() => void handleExportSubmit()} disabled={isExporting}>
                  {isExporting
                    ? messages.proctors.exportFlow.submitting
                    : messages.proctors.exportFlow.submit}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
