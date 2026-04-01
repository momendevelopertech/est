"use client";

import { useEffect, useMemo, useState } from "react";

import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { Locale, Messages } from "@/lib/i18n";

import { QuickActions } from "./quick-actions";
import { StatCard } from "./stat-card";
import { StatusDistributionChart } from "./status-distribution-chart";

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
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M9 4h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V6a2 2 0 0 1 2-2Zm0 3h6V6H9v1Zm1 5h5m-5 4h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PercentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="m19 5-14 14M7.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M7 4h8l4 4v12H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 1.5V9h3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 13h6M9 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AttendanceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M8 7h8M8 12h8M8 17h5M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SessionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6 3v3M18 3v3M4 10h16M5 6h14a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6 4.5A2.5 2.5 0 0 1 8.5 2H19v18h-10a2.5 2.5 0 0 0-2.5 2M6 4.5A2.5 2.5 0 0 0 3.5 7v13.5C3.5 19.12 4.62 18 6 18h13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

  const copy = useMemo(
    () => ({
      liveSnapshot: locale === "ar" ? "لقطة تشغيلية مباشرة" : "Live operational snapshot",
      activeSessions: locale === "ar" ? "جلسات نشطة" : "Active sessions",
      completedAssignments:
        locale === "ar" ? "تكليفات مكتملة" : "Completed assignments",
      pendingAttendance:
        locale === "ar" ? "حضور قيد المتابعة" : "Attendance pending review",
      sessionsSubtitle:
        locale === "ar"
          ? "مرتبة بواجهات مؤشرات النظام"
          : "Ordered from live system indicators",
      assignmentsSubtitle:
        locale === "ar"
          ? "تعكس مسار التوزيع والتكليف الحالي"
          : "Reflecting the current assignment flow",
      attendanceSubtitle:
        locale === "ar"
          ? "تعرض آخر حالة حضور لكل تكليف"
          : "Showing the latest attendance state per assignment",
      coverageMetrics:
        locale === "ar" ? "مؤشرات التغطية" : "Coverage metrics"
    }),
    [locale]
  );

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
        label: messages.dashboard.workspace.stats.totalSessions,
        value: formatNumber(locale, sessions.totals.totalSessions),
        trend: `${copy.activeSessions}: ${formatNumber(
          locale,
          sessions.totals.activeSessions
        )}`,
        tone: "accent" as const,
        icon: <CalendarIcon />
      },
      {
        key: "totalAssignments",
        label: messages.dashboard.workspace.stats.totalAssignments,
        value: formatNumber(locale, assignments.totals.totalAssignments),
        trend: `${copy.completedAssignments}: ${formatNumber(
          locale,
          assignments.totals.completedAssignments
        )}`,
        tone: "warning" as const,
        icon: <ClipboardIcon />
      },
      {
        key: "confirmedAttendance",
        label: messages.dashboard.workspace.stats.confirmedAttendance,
        value: formatNumber(locale, attendance.totals.confirmedCount),
        trend: `${copy.pendingAttendance}: ${formatNumber(
          locale,
          attendance.totals.pendingCount
        )}`,
        tone: "success" as const,
        icon: <CheckCircleIcon />
      },
      {
        key: "attendanceRatio",
        label: messages.dashboard.workspace.stats.attendanceRatio,
        value: `${formatPercent(locale, attendance.totals.attendanceRatio * 100)}%`,
        trend: `${messages.dashboard.workspace.sections.attendanceRecords}: ${formatNumber(
          locale,
          attendance.totals.attendanceRecords
        )}`,
        tone: "danger" as const,
        icon: <PercentIcon />
      }
    ];
  }, [assignments, attendance, copy, locale, messages.dashboard.workspace, sessions]);

  const sessionsChartData = useMemo(
    () =>
      (sessions?.statusBreakdown ?? []).map((item) => ({
        name: getLocalizedLabel(locale, item),
        value: item.count
      })),
    [locale, sessions?.statusBreakdown]
  );

  const assignmentsChartData = useMemo(
    () =>
      (assignments?.statusBreakdown ?? []).map((item) => ({
        name: getLocalizedLabel(locale, item),
        value: item.count
      })),
    [assignments?.statusBreakdown, locale]
  );

  const attendanceChartData = useMemo(
    () =>
      (attendance?.statusBreakdown ?? []).map((item) => ({
        name: getLocalizedLabel(locale, item),
        value: item.count
      })),
    [attendance?.statusBreakdown, locale]
  );

  const quickActions = useMemo(() => {
    const items = [
      {
        href: "/reports",
        path: "/reports",
        label: messages.reports.hub.title,
        icon: <ReportIcon />
      },
      {
        href: "/reports/assignments",
        path: "/reports/assignments",
        label: messages.reports.pages.assignments.title,
        icon: <ClipboardIcon />
      },
      {
        href: "/reports/attendance",
        path: "/reports/attendance",
        label: messages.reports.pages.attendance.title,
        icon: <AttendanceIcon />
      },
      {
        href: "/sessions",
        path: "/sessions",
        label: messages.nav.sessions,
        icon: <SessionIcon />
      }
    ];

    if (canAccessTestGuide) {
      items.push({
        href: "/test",
        path: "/test",
        label: messages.nav.testGuide,
        icon: <GuideIcon />
      });
    }

    return items;
  }, [canAccessTestGuide, messages.nav, messages.reports]);

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-transparent bg-[linear-gradient(135deg,#111827_0%,#1A1A1A_55%,#0F172A_100%)] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        </div>

        <CardHeader className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-[color:var(--accent-contrast)]">
              EST
            </span>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              {userRoleLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.85fr)] xl:items-end">
            <div>
              <CardTitle className="text-3xl text-white sm:text-[2.6rem]">
                {messages.dashboard.title}
              </CardTitle>
              <CardDescription className="mt-3 max-w-3xl text-base text-white/70">
                {messages.dashboard.subtitle}
              </CardDescription>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                {copy.liveSnapshot}
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {messages.dashboard.workspace.sections.coverageBody}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-xs text-white/60">{copy.activeSessions}</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {isLoading ? "--" : formatNumber(locale, sessions?.totals.activeSessions ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <p className="text-xs text-white/60">{copy.completedAssignments}</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {isLoading
                      ? "--"
                      : formatNumber(locale, assignments?.totals.completedAssignments ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative mt-6 flex flex-wrap gap-3">
          <ActionLink href="/sessions" variant="primary">
            {messages.dashboard.workspace.actions.openSessions}
          </ActionLink>
          <ActionLink href="/reports" variant="secondary">
            {messages.dashboard.workspace.actions.openReports}
          </ActionLink>
          {canAccessTestGuide ? (
            <ActionLink href="/test" variant="secondary">
              {messages.dashboard.workspace.actions.openTestGuide}
            </ActionLink>
          ) : null}
          <Button
            size="md"
            variant="ghost"
            className="border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setRefreshKey((current) => current + 1)}
          >
            {messages.dashboard.workspace.actions.refreshMetrics}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-[18px] border border-border bg-surface-elevated"
              />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-[24rem] animate-pulse rounded-[18px] border border-border bg-surface-elevated"
              />
            ))}
          </div>
        </>
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
            {topStats.map((stat) => (
              <StatCard
                key={stat.key}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                trend={stat.trend}
                tone={stat.tone}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="grid gap-4 lg:grid-cols-2">
              <StatusDistributionChart
                title={messages.dashboard.workspace.sections.sessionStatuses}
                subtitle={copy.sessionsSubtitle}
                data={sessionsChartData}
                locale={locale}
              />
              <StatusDistributionChart
                title={messages.dashboard.workspace.sections.assignmentStatuses}
                subtitle={copy.assignmentsSubtitle}
                data={assignmentsChartData}
                locale={locale}
              />
            </div>

            <Card className="h-full">
              <CardHeader>
                <CardTitle>{messages.dashboard.workspace.sections.coverageTitle}</CardTitle>
                <CardDescription>
                  {messages.dashboard.workspace.sections.coverageBody}
                </CardDescription>
              </CardHeader>

              <CardContent className="mt-6 space-y-3">
                <div className="rounded-[16px] border border-border bg-[color:var(--surface-strong)] px-4 py-3">
                  <p className="text-xs font-semibold text-text-muted">{copy.coverageMetrics}</p>
                  <p className="mt-2 text-2xl font-bold text-text-primary">
                    {formatPercent(locale, attendance.totals.attendanceRatio * 100)}%
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-[16px] border border-border bg-surface-elevated px-4 py-3 text-sm">
                    <span className="text-text-secondary">
                      {messages.dashboard.workspace.sections.uniqueAssignedUsers}
                    </span>
                    <span className="font-semibold text-text-primary">
                      {formatNumber(locale, assignments.totals.uniqueAssignedUsers)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-[16px] border border-border bg-surface-elevated px-4 py-3 text-sm">
                    <span className="text-text-secondary">
                      {messages.dashboard.workspace.sections.attendanceRecords}
                    </span>
                    <span className="font-semibold text-text-primary">
                      {formatNumber(locale, attendance.totals.attendanceRecords)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-[16px] border border-border bg-surface-elevated px-4 py-3 text-sm">
                    <span className="text-text-secondary">
                      {messages.dashboard.workspace.sections.completedAssignments}
                    </span>
                    <span className="font-semibold text-text-primary">
                      {formatNumber(locale, assignments.totals.completedAssignments)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-[16px] border border-border bg-surface-elevated px-4 py-3 text-sm">
                    <span className="text-text-secondary">
                      {messages.dashboard.workspace.sections.cancelledAssignments}
                    </span>
                    <span className="font-semibold text-text-primary">
                      {formatNumber(locale, assignments.totals.cancelledAssignments)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <StatusDistributionChart
              title={messages.dashboard.workspace.sections.attendanceDistributionTitle}
              subtitle={copy.attendanceSubtitle}
              data={attendanceChartData}
              locale={locale}
            />

            <Card className="h-full">
              <CardHeader>
                <CardTitle>{messages.dashboard.workspace.sections.quickActionsTitle}</CardTitle>
                <CardDescription>
                  {messages.dashboard.workspace.sections.quickActionsBody}
                </CardDescription>
              </CardHeader>

              <CardContent className="mt-6">
                <QuickActions items={quickActions} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
