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
import { Input } from "@/components/ui/input";
import type { Locale, Messages } from "@/lib/i18n";

type ReportType = "assignments" | "attendance" | "evaluations";

type ReportCard = {
  key: string;
  value: number;
  labelEn: string;
  labelAr: string;
  format?: "number" | "decimal" | "percent";
};

type ReportBreakdownItem = {
  key: string;
  count: number;
  labelEn: string;
  labelAr: string;
};

type ReportBreakdownSection = {
  key: string;
  titleEn: string;
  titleAr: string;
  items: ReportBreakdownItem[];
};

type ReportSummaryResponse = {
  ok: boolean;
  data?: {
    reportType: ReportType;
    generatedAt: string;
    cards: ReportCard[];
    breakdowns: ReportBreakdownSection[];
    exportUrl: string | null;
  };
  error?: string;
  message?: string;
};

type ReportSummaryWorkspaceProps = {
  locale: Locale;
  messages: Messages;
  reportType: ReportType;
};

type FiltersState = {
  sessionId: string;
  cycleId: string;
  locationId: string;
};

function getInitialFiltersState(): FiltersState {
  return {
    sessionId: "",
    cycleId: "",
    locationId: ""
  };
}

function formatCardValue(card: ReportCard, locale: Locale) {
  if (card.format === "percent") {
    return `${card.value.toFixed(2)}%`;
  }

  if (card.format === "decimal") {
    return card.value.toFixed(2);
  }

  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(card.value);
}

export function ReportSummaryWorkspace({
  locale,
  messages,
  reportType
}: ReportSummaryWorkspaceProps) {
  const [draftFilters, setDraftFilters] = useState<FiltersState>(() =>
    getInitialFiltersState()
  );
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(() =>
    getInitialFiltersState()
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportSummaryResponse["data"] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("locale", locale);

      if (appliedFilters.sessionId) {
        params.set("sessionId", appliedFilters.sessionId.trim());
      }

      if (appliedFilters.cycleId) {
        params.set("cycleId", appliedFilters.cycleId.trim());
      }

      if (appliedFilters.locationId) {
        params.set("locationId", appliedFilters.locationId.trim());
      }

      try {
        const response = await fetch(
          `/api/reports/${reportType}?${params.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            headers: {
              Accept: "application/json"
            },
            signal: controller.signal
          }
        );
        const payload = (await response.json()) as ReportSummaryResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.message ?? payload.error ?? "report_summary_failed");
        }

        setSummary(payload.data);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(loadError);
        setSummary(null);
        setError(messages.reports.summary.errorBody);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      controller.abort();
    };
  }, [
    appliedFilters.cycleId,
    appliedFilters.locationId,
    appliedFilters.sessionId,
    locale,
    messages.reports.summary.errorBody,
    refreshKey,
    reportType
  ]);

  const pageCopy = messages.reports.pages[reportType];
  const hasExport = Boolean(summary?.exportUrl);
  const totalCards = useMemo(() => summary?.cards ?? [], [summary]);

  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{messages.nav.reports}</Badge>
          </div>
          <CardTitle className="text-3xl">{pageCopy.title}</CardTitle>
          <CardDescription className="text-base">{pageCopy.subtitle}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.reports.filters.title}</CardTitle>
          <CardDescription>{messages.reports.filters.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="reports-session-id">
                {messages.reports.filters.sessionId}
              </label>
              <Input
                id="reports-session-id"
                value={draftFilters.sessionId}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    sessionId: event.target.value
                  }))
                }
                placeholder={messages.reports.filters.sessionIdPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="reports-cycle-id">
                {messages.reports.filters.cycleId}
              </label>
              <Input
                id="reports-cycle-id"
                value={draftFilters.cycleId}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    cycleId: event.target.value
                  }))
                }
                placeholder={messages.reports.filters.cycleIdPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="reports-location-id">
                {messages.reports.filters.locationId}
              </label>
              <Input
                id="reports-location-id"
                value={draftFilters.locationId}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    locationId: event.target.value
                  }))
                }
                placeholder={messages.reports.filters.locationIdPlaceholder}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={() =>
                setAppliedFilters({
                  sessionId: draftFilters.sessionId.trim(),
                  cycleId: draftFilters.cycleId.trim(),
                  locationId: draftFilters.locationId.trim()
                })
              }
            >
              {messages.reports.filters.apply}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const reset = getInitialFiltersState();
                setDraftFilters(reset);
                setAppliedFilters(reset);
              }}
            >
              {messages.reports.filters.clear}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRefreshKey((current) => current + 1)}
            >
              {messages.reports.summary.reload}
            </Button>
            {hasExport ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={isExporting}
                onClick={() => {
                  if (!summary?.exportUrl) {
                    return;
                  }

                  setIsExporting(true);
                  window.location.assign(summary.exportUrl);
                  window.setTimeout(() => setIsExporting(false), 900);
                }}
              >
                {isExporting
                  ? messages.reports.summary.exporting
                  : messages.reports.summary.export}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-3xl border border-border bg-surface-elevated"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.reports.summary.errorTitle}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!isLoading && !error && summary ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{messages.reports.summary.cardsTitle}</CardTitle>
              <CardDescription>{messages.reports.summary.cardsSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {totalCards.map((card) => (
                <Card key={card.key}>
                  <CardHeader>
                    <CardDescription>
                      {locale === "ar" ? card.labelAr : card.labelEn}
                    </CardDescription>
                    <CardTitle className="text-3xl">
                      {formatCardValue(card, locale)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {summary.breakdowns.map((section) => (
              <Card key={section.key}>
                <CardHeader>
                  <CardTitle>
                    {locale === "ar" ? section.titleAr : section.titleEn}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.items.length === 0 ? (
                    <p className="text-sm text-text-secondary">
                      {messages.reports.summary.emptyBreakdown}
                    </p>
                  ) : (
                    section.items.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-3 py-2 text-sm"
                      >
                        <span className="text-text-secondary">
                          {locale === "ar" ? item.labelAr : item.labelEn}
                        </span>
                        <span className="font-semibold text-text-primary">{item.count}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
