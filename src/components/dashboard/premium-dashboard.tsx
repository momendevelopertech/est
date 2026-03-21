"use client";

import Link from "next/link";
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
import type { Locale, Messages } from "@/lib/i18n";

type MetricsBreakdownItem = {
  key: string;
  count: number;
  labelEn: string;
  labelAr: string;
};

type SessionsMetricsResponse = {
  ok: boolean;
  data?: {
    totals: {
      totalSessions: number;
      activeSessions: number;
      completedSessions: number;
      cancelledSessions: number;
    };
    statusBreakdown: MetricsBreakdownItem[];
  };
};

type AssignmentsMetricsResponse = {
  ok: boolean;
  data?: {
    totals: {
      totalAssignments: number;
      uniqueAssignedUsers: number;
      manualAssignments: number;
      autoAssignments: number;
      cancelledAssignments: number;
      completedAssignments: number;
    };
    statusBreakdown: MetricsBreakdownItem[];
  };
};

type AttendanceMetricsResponse = {
  ok: boolean;
  data?: {
    totals: {
      totalAssignments: number;
      attendanceRecords: number;
      pendingCount: number;
      confirmedCount: number;
      absentCount: number;
      declinedCount: number;
      attendanceRatio: number;
    };
    statusBreakdown: MetricsBreakdownItem[];
  };
};

type PremiumDashboardProps = {
  locale: Locale;
  messages: Messages;
  userRoleLabel: string;
  canAccessTestGuide: boolean;
};

function formatNumber(locale: Locale, value: number) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(value);
}

function formatPercent(locale: Locale, value: number) {
  const number = locale === "ar" ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(number, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function getLocalizedLabel(
  locale: Locale,
  item: {
    labelEn: string;
    labelAr: string;
  }
) {
  return locale === "ar" ? item.labelAr : item.labelEn;
}

export function PremiumDashboard({
  locale,
  messages,
  userRoleLabel,
  canAccessTestGuide
}: PremiumDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sessions, setSessions] =
    useState<SessionsMetricsResponse["data"] | null>(null);
  const [assignments, setAssignments] =
    useState<AssignmentsMetricsResponse["data"] | null>(null);
  const [attendance, setAttendance] =
    useState<AttendanceMetricsResponse["data"] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMetrics() {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        locale
      });

      try {
        const [sessionsResponse, assignmentsResponse, attendanceResponse] =
          await Promise.all([
            fetch(`/api/metrics/sessions?${params.toString()}`, {
              method: "GET",
              credentials: "same-origin",
              headers: {
                Accept: "application/json"
              },
              signal: controller.signal
            }),
            fetch(`/api/metrics/assignments?${params.toString()}`, {
              method: "GET",
              credentials: "same-origin",
              headers: {
                Accept: "application/json"
              },
              signal: controller.signal
            }),
            fetch(`/api/metrics/attendance?${params.toString()}`, {
              method: "GET",
              credentials: "same-origin",
              headers: {
                Accept: "application/json"
              },
              signal: controller.signal
            })
          ]);

        const [sessionsPayload, assignmentsPayload, attendancePayload] =
          (await Promise.all([
            sessionsResponse.json(),
            assignmentsResponse.json(),
            attendanceResponse.json()
          ])) as [
            SessionsMetricsResponse,
            AssignmentsMetricsResponse,
            AttendanceMetricsResponse
          ];

        if (
          !sessionsResponse.ok ||
          !assignmentsResponse.ok ||
          !attendanceResponse.ok ||
          !sessionsPayload.ok ||
          !assignmentsPayload.ok ||
          !attendancePayload.ok ||
          !sessionsPayload.data ||
          !assignmentsPayload.data ||
          !attendancePayload.data
        ) {
          throw new Error("dashboard_metrics_failed");
        }

        setSessions(sessionsPayload.data);
        setAssignments(assignmentsPayload.data);
        setAttendance(attendancePayload.data);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(loadError);
        setError(messages.dashboard.workspace.errors.loadBody);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadMetrics();

    return () => controller.abort();
  }, [locale, messages.dashboard.workspace.errors.loadBody, refreshKey]);

  const topStats = useMemo(() => {
    if (!sessions || !assignments || !attendance) {
      return [];
    }

    return [
      {
        key: "totalSessions",
        title: messages.dashboard.workspace.stats.totalSessions,
        value: sessions.totals.totalSessions
      },
      {
        key: "totalAssignments",
        title: messages.dashboard.workspace.stats.totalAssignments,
        value: assignments.totals.totalAssignments
      },
      {
        key: "confirmedAttendance",
        title: messages.dashboard.workspace.stats.confirmedAttendance,
        value: attendance.totals.confirmedCount
      },
      {
        key: "attendanceRatio",
        title: messages.dashboard.workspace.stats.attendanceRatio,
        value: Number((attendance.totals.attendanceRatio * 100).toFixed(2)),
        suffix: "%"
      }
    ];
  }, [attendance, assignments, messages.dashboard.workspace.stats, sessions]);

  const sessionMax = Math.max(
    ...(sessions?.statusBreakdown.map((item) => item.count) ?? [0]),
    1
  );
  const assignmentMax = Math.max(
    ...(assignments?.statusBreakdown.map((item) => item.count) ?? [0]),
    1
  );
  const attendanceMax = Math.max(
    ...(attendance?.statusBreakdown.map((item) => item.count) ?? [0]),
    1
  );

  return (
    <div className="space-y-6">
      <Card className="panel relative overflow-hidden border-transparent px-6 py-6 sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-success/20 blur-3xl" />
        </div>
        <CardHeader className="relative">
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{userRoleLabel}</Badge>
          </div>
          <CardTitle className="text-3xl">{messages.dashboard.title}</CardTitle>
          <CardDescription className="max-w-3xl text-base">
            {messages.dashboard.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative flex flex-wrap gap-3">
          <Link href="/reports">
            <Button size="sm">{messages.dashboard.workspace.actions.openReports}</Button>
          </Link>
          <Link href="/sessions">
            <Button size="sm" variant="secondary">
              {messages.dashboard.workspace.actions.openSessions}
            </Button>
          </Link>
          {canAccessTestGuide ? (
            <Link href="/test">
              <Button size="sm" variant="secondary">
                {messages.dashboard.workspace.actions.openTestGuide}
              </Button>
            </Link>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRefreshKey((current) => current + 1)}
          >
            {messages.dashboard.workspace.actions.refreshMetrics}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
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
            <CardTitle>{messages.dashboard.workspace.errors.loadTitle}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={() => setRefreshKey((current) => current + 1)}>
              {messages.dashboard.workspace.errors.retry}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && sessions && assignments && attendance ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {topStats.map((card) => (
              <Card key={card.key} className="panel border-transparent">
                <CardHeader>
                  <CardDescription>{card.title}</CardDescription>
                  <CardTitle className="text-3xl">
                    {formatNumber(locale, card.value)}
                    {card.suffix ?? ""}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>{messages.dashboard.workspace.sections.distributionTitle}</CardTitle>
                <CardDescription>
                  {messages.dashboard.workspace.sections.distributionBody}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-text-primary">
                    {messages.dashboard.workspace.sections.sessionStatuses}
                  </p>
                  {sessions.statusBreakdown.map((item) => {
                    const percent = Math.round((item.count / sessionMax) * 100);

                    return (
                      <div key={item.key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">
                            {getLocalizedLabel(locale, item)}
                          </span>
                          <span className="font-medium text-text-primary">
                            {formatNumber(locale, item.count)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-elevated">
                          <div
                            className="h-2 rounded-full bg-accent transition-[width] duration-300"
                            style={{
                              width: `${percent}%`
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-text-primary">
                    {messages.dashboard.workspace.sections.assignmentStatuses}
                  </p>
                  {assignments.statusBreakdown.map((item) => {
                    const percent = Math.round((item.count / assignmentMax) * 100);

                    return (
                      <div key={item.key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">
                            {getLocalizedLabel(locale, item)}
                          </span>
                          <span className="font-medium text-text-primary">
                            {formatNumber(locale, item.count)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-elevated">
                          <div
                            className="h-2 rounded-full bg-info transition-[width] duration-300"
                            style={{
                              width: `${percent}%`
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{messages.dashboard.workspace.sections.quickActionsTitle}</CardTitle>
                <CardDescription>
                  {messages.dashboard.workspace.sections.quickActionsBody}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href="/reports/assignments"
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary"
                >
                  <span>{messages.reports.pages.assignments.title}</span>
                  <span className="text-text-secondary">/reports/assignments</span>
                </Link>
                <Link
                  href="/reports/attendance"
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary"
                >
                  <span>{messages.reports.pages.attendance.title}</span>
                  <span className="text-text-secondary">/reports/attendance</span>
                </Link>
                <Link
                  href="/reports/evaluations"
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary"
                >
                  <span>{messages.reports.pages.evaluations.title}</span>
                  <span className="text-text-secondary">/reports/evaluations</span>
                </Link>
                <Link
                  href="/reports"
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary"
                >
                  <span>{messages.reports.hub.title}</span>
                  <span className="text-text-secondary">/reports</span>
                </Link>
                {canAccessTestGuide ? (
                  <Link
                    href="/test"
                    className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary"
                  >
                    <span>{messages.nav.testGuide}</span>
                    <span className="text-text-secondary">/test</span>
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {messages.dashboard.workspace.sections.attendanceDistributionTitle}
                </CardTitle>
                <CardDescription>
                  {`${messages.dashboard.workspace.sections.attendanceRatioPrefix}: ${formatPercent(
                    locale,
                    attendance.totals.attendanceRatio * 100
                  )}%`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {attendance.statusBreakdown.map((item) => {
                  const percent = Math.round((item.count / attendanceMax) * 100);

                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">
                          {getLocalizedLabel(locale, item)}
                        </span>
                        <span className="font-medium text-text-primary">
                          {formatNumber(locale, item.count)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-elevated">
                        <div
                          className="h-2 rounded-full bg-success transition-[width] duration-300"
                          style={{
                            width: `${percent}%`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{messages.dashboard.workspace.sections.coverageTitle}</CardTitle>
                <CardDescription>
                  {messages.dashboard.workspace.sections.coverageBody}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm">
                  <span className="text-text-secondary">
                    {messages.dashboard.workspace.sections.uniqueAssignedUsers}
                  </span>
                  <span className="font-semibold text-text-primary">
                    {formatNumber(locale, assignments.totals.uniqueAssignedUsers)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm">
                  <span className="text-text-secondary">
                    {messages.dashboard.workspace.sections.attendanceRecords}
                  </span>
                  <span className="font-semibold text-text-primary">
                    {formatNumber(locale, attendance.totals.attendanceRecords)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm">
                  <span className="text-text-secondary">
                    {messages.dashboard.workspace.sections.completedAssignments}
                  </span>
                  <span className="font-semibold text-text-primary">
                    {formatNumber(locale, assignments.totals.completedAssignments)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm">
                  <span className="text-text-secondary">
                    {messages.dashboard.workspace.sections.cancelledAssignments}
                  </span>
                  <span className="font-semibold text-text-primary">
                    {formatNumber(locale, assignments.totals.cancelledAssignments)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
