"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/ui/page-hero";
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
    exportOptions?: {
      csv: string | null;
      excel: string | null;
      pdf: string | null;
    };
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

function getLocalizedLabel(locale: Locale, item: { labelEn: string; labelAr: string }) {
  return locale === "ar" ? item.labelAr : item.labelEn;
}

function getExportOptions(summary: ReportSummaryResponse["data"] | null) {
  if (!summary) {
    return {
      csv: null,
      excel: null,
      pdf: null
    };
  }

  if (summary.exportOptions) {
    return summary.exportOptions;
  }

  return {
    csv: summary.exportUrl,
    excel: null,
    pdf: null
  };
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
  const totalCards = useMemo(() => summary?.cards ?? [], [summary]);
  const exportOptions = getExportOptions(summary);
  const exportActions = [
    {
      key: "csv",
      label: "CSV",
      href: exportOptions.csv
    },
    {
      key: "excel",
      label: "Excel",
      href: exportOptions.excel
    },
    {
      key: "pdf",
      label: "PDF",
      href: exportOptions.pdf
    }
  ] as const;
  const hasExport = exportActions.some((item) => Boolean(item.href));
  const activeFilters = [
    {
      key: "sessionId",
      label: messages.reports.filters.sessionId,
      value: appliedFilters.sessionId
    },
    {
      key: "cycleId",
      label: messages.reports.filters.cycleId,
      value: appliedFilters.cycleId
    },
    {
      key: "locationId",
      label: messages.reports.filters.locationId,
      value: appliedFilters.locationId
    }
  ].filter((item) => item.value.trim().length > 0);

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.nav.reports }
        ]}
        title={pageCopy.title}
        description={pageCopy.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.reports.summary.cardsSubtitle}
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-text-primary">
              {totalCards.length}
            </p>
          </>
        }
        actions={
          <>
            <ActionLink href="/reports">{messages.reports.hub.title}</ActionLink>
            <ActionLink href="/dashboard">{messages.nav.dashboard}</ActionLink>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{messages.reports.filters.title}</CardTitle>
            <CardDescription>{messages.reports.filters.subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="reports-session-id"
                >
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
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="reports-cycle-id"
                >
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
                <label
                  className="text-sm font-medium text-text-primary"
                  htmlFor="reports-location-id"
                >
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{messages.reports.workspace.exportTitle}</CardTitle>
            <CardDescription>{messages.reports.workspace.exportBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasExport ? (
              exportActions.map((action) => (
                <Button
                  key={action.key}
                  variant={action.key === "pdf" ? "primary" : "secondary"}
                  size="sm"
                  className="w-full"
                  disabled={isExporting || !action.href}
                  onClick={() => {
                    if (!action.href) {
                      return;
                    }

                    setIsExporting(true);
                    window.location.assign(action.href);
                    window.setTimeout(() => setIsExporting(false), 900);
                  }}
                >
                  {isExporting
                    ? messages.reports.summary.exporting
                    : `${messages.reports.summary.export} ${action.label}`}
                </Button>
              ))
            ) : (
              <p className="text-sm text-text-secondary">
                {messages.reports.workspace.noExport}
              </p>
            )}
            {summary ? (
              <p className="text-xs text-text-secondary">
                {messages.reports.workspace.generatedAt}:{" "}
                {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
                  dateStyle: "medium",
                  timeStyle: "short"
                }).format(new Date(summary.generatedAt))}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {activeFilters.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.reports.workspace.activeFilters}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <Badge key={filter.key}>
                {filter.label}: {filter.value}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
                <Card key={card.key} className="panel border-transparent">
                  <CardHeader>
                    <CardDescription>{getLocalizedLabel(locale, card)}</CardDescription>
                    <CardTitle className="text-3xl">
                      {formatCardValue(card, locale)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {summary.breakdowns.map((section) => {
              const maxCount = Math.max(
                ...(section.items.map((item) => item.count) ?? [0]),
                1
              );

              return (
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
                      section.items.map((item) => {
                        const ratio = Math.round((item.count / maxCount) * 100);

                        return (
                          <div
                            key={item.key}
                            className="space-y-2 rounded-2xl border border-border bg-surface-elevated px-3 py-3 text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-text-secondary">
                                {getLocalizedLabel(locale, item)}
                              </span>
                              <span className="font-semibold text-text-primary">
                                {new Intl.NumberFormat(
                                  locale === "ar" ? "ar-EG" : "en-US"
                                ).format(item.count)}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-surface">
                              <div
                                className="h-2 rounded-full bg-accent transition-[width] duration-300"
                                style={{
                                  width: `${ratio}%`
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
