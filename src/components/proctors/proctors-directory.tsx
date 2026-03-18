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
import { Input } from "@/components/ui/input";
import type { Locale, Messages } from "@/lib/i18n";
import {
  getAlternateLocalizedName,
  getLocalizedName
} from "@/lib/locations/presentation";

type ProctorSource = "SPHINX" | "UNIVERSITY" | "EXTERNAL";
type BlockStatus = "CLEAR" | "TEMPORARY" | "PERMANENT";
type PreferredLanguage = "AR" | "EN" | null;

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

type ProctorsDirectoryProps = {
  locale: Locale;
  messages: Messages;
};

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

  return locale === "ar" ? "—" : "—";
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-text-primary">{value ?? "—"}</p>
    </div>
  );
}

export function ProctorsDirectory({ locale, messages }: ProctorsDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | ProctorSource>("");
  const [blockStatusFilter, setBlockStatusFilter] = useState<"" | BlockStatus>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listState, setListState] = useState<{
    isLoading: boolean;
    error: string | null;
    errorCode: string | null;
    data: ProctorRecord[];
  }>({
    isLoading: true,
    error: null,
    errorCode: null,
    data: []
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<{
    isLoading: boolean;
    error: string | null;
    errorCode: string | null;
    data: ProctorRecord | null;
  }>({
    isLoading: false,
    error: null,
    errorCode: null,
    data: null
  });

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

  const selectedProctor = detailState.data;
  const listCount = listState.data.length;

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
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 xl:col-span-2">
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
                className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">{messages.proctors.filters.allSources}</option>
                <option value="SPHINX">{messages.proctors.sources.SPHINX}</option>
                <option value="UNIVERSITY">{messages.proctors.sources.UNIVERSITY}</option>
                <option value="EXTERNAL">{messages.proctors.sources.EXTERNAL}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="proctors-block-status">
                {messages.proctors.filters.blockStatus}
              </label>
              <select
                id="proctors-block-status"
                value={blockStatusFilter}
                onChange={(event) =>
                  setBlockStatusFilter(event.target.value as "" | BlockStatus)
                }
                className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">{messages.proctors.filters.allBlockStatuses}</option>
                <option value="CLEAR">{messages.proctors.blockStatuses.CLEAR}</option>
                <option value="TEMPORARY">{messages.proctors.blockStatuses.TEMPORARY}</option>
                <option value="PERMANENT">{messages.proctors.blockStatuses.PERMANENT}</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
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
                      className={`w-full rounded-3xl border px-4 py-4 text-start transition-colors ${
                        isSelected
                          ? "border-accent bg-surface-elevated"
                          : "border-border bg-surface hover:bg-surface-elevated"
                      }`}
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
                          {messages.proctors.labels.organization}:{" "}
                          {proctor.organization ?? "—"}
                        </p>
                        <p>
                          {messages.proctors.labels.governorate}:{" "}
                          {proctor.governorate
                            ? getLocalizedName(proctor.governorate, locale)
                            : "—"}
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
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow
                    label={messages.proctors.labels.phone}
                    value={selectedProctor.phone}
                  />
                  <DetailRow
                    label={messages.proctors.labels.email}
                    value={selectedProctor.email}
                  />
                  <DetailRow
                    label={messages.proctors.labels.nationalId}
                    value={selectedProctor.nationalId}
                  />
                  <DetailRow
                    label={messages.proctors.labels.organization}
                    value={selectedProctor.organization}
                  />
                  <DetailRow
                    label={messages.proctors.labels.branch}
                    value={selectedProctor.branch}
                  />
                  <DetailRow
                    label={messages.proctors.labels.governorate}
                    value={
                      selectedProctor.governorate
                        ? getLocalizedName(selectedProctor.governorate, locale)
                        : null
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
                    value={formatDate(locale, selectedProctor.blockEndsAt)}
                  />
                  <DetailRow
                    label={messages.proctors.labels.updatedAt}
                    value={formatDate(locale, selectedProctor.updatedAt)}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
