import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { Locale, Messages } from "@/lib/i18n";
import { getAlternateLocalizedName, getLocalizedName } from "@/lib/i18n/presentation";
import type { getSessionById } from "@/lib/sessions/service";
import { getDerivedSessionStatus } from "@/lib/sessions/status";
import { sessionLifecycleSequence } from "@/lib/sessions/status-ui";

import { SessionStatusBadge } from "./session-status-badge";

type SessionDetailData = Awaited<ReturnType<typeof getSessionById>>;

function formatDate(locale: Locale, value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatDateTime(locale: Locale, value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function DetailItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-2 text-sm leading-7 text-text-primary">{value}</p>
    </div>
  );
}

function StatCard({
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

function formatBuildingPath(data: SessionDetailData, locale: Locale) {
  return data.buildings
    .filter((buildingLink) => buildingLink.isActive)
    .map((buildingLink) => {
      const building = buildingLink.building;

      return [
        getLocalizedName(building, locale),
        getLocalizedName(building.university, locale),
        getLocalizedName(building.university.governorate, locale)
      ].join(" / ");
    });
}

export function SessionDetailView({
  data,
  locale,
  messages
}: {
  data: SessionDetailData;
  locale: Locale;
  messages: Messages;
}) {
  const sessionName = getLocalizedName(data, locale);
  const alternateName = getAlternateLocalizedName(data, locale);
  const storedStatus = data.status;
  const derivedStatus = getDerivedSessionStatus(data);
  const buildingPaths = formatBuildingPath(data, locale);

  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{messages.nav.sessions}</Badge>
            <Badge>{messages.sessions.examTypes[data.examType]}</Badge>
            <Badge>{data.isActive ? messages.sessions.labels.active : messages.sessions.labels.inactive}</Badge>
            <SessionStatusBadge status={storedStatus} label={messages.sessions.statuses[storedStatus]} />
            <SessionStatusBadge status={derivedStatus} label={messages.sessions.statuses[derivedStatus]} />
          </div>
          <CardTitle className="text-3xl">{sessionName}</CardTitle>
          <CardDescription className="text-base">
            {alternateName ?? messages.sessions.detailBody}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              {messages.sessions.labels.cycle}: {getLocalizedName(data.cycle, locale)}
            </p>
            <p>
              {messages.sessions.labels.startDateTime}: {formatDateTime(locale, data.startsAt)}
            </p>
            <p>
              {messages.sessions.labels.endDateTime}: {formatDateTime(locale, data.endsAt)}
            </p>
          </div>
          <Link
            href="/sessions"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-4 text-sm font-medium text-white shadow-panel transition-colors hover:bg-accent-hover"
          >
            {messages.sessions.detailBack}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.sessions.snapshotTitle}</CardTitle>
          <CardDescription>{messages.sessions.snapshotBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={messages.sessions.labels.assignments} value={data._count.assignments} />
          <StatCard label={messages.sessions.labels.waitingList} value={data._count.waitingList} />
          <StatCard label={messages.sessions.labels.evaluations} value={data._count.evaluations} />
          <StatCard label={messages.sessions.labels.buildings} value={data._count.buildings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.sessions.lifecycle.title}</CardTitle>
          <CardDescription>
            {storedStatus === "CANCELLED" ? messages.sessions.lifecycle.cancelled : messages.sessions.lifecycle.live}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {sessionLifecycleSequence.map((status) => (
            <SessionStatusBadge
              key={status}
              status={status}
              label={messages.sessions.statuses[status]}
            />
          ))}
          {storedStatus === "CANCELLED" ? (
            <SessionStatusBadge
              status="CANCELLED"
              label={messages.sessions.statuses.CANCELLED}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.sessions.detailTitle}</CardTitle>
          <CardDescription>{messages.sessions.detailBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailItem label={messages.sessions.labels.cycle} value={getLocalizedName(data.cycle, locale)} />
          <DetailItem label={messages.sessions.labels.examType} value={messages.sessions.examTypes[data.examType]} />
          <DetailItem label={messages.sessions.labels.sessionDate} value={formatDate(locale, data.sessionDate)} />
          <DetailItem label={messages.sessions.labels.dayIndex} value={data.dayIndex?.toString() ?? "-"} />
          <DetailItem label={messages.sessions.labels.status} value={messages.sessions.statuses[storedStatus]} />
          <DetailItem label={messages.sessions.labels.derivedStatus} value={messages.sessions.statuses[derivedStatus]} />
          <DetailItem label={messages.sessions.labels.startDateTime} value={formatDateTime(locale, data.startsAt)} />
          <DetailItem label={messages.sessions.labels.endDateTime} value={formatDateTime(locale, data.endsAt)} />
          <DetailItem label={messages.sessions.labels.lockedAt} value={formatDateTime(locale, data.lockedAt)} />
          <DetailItem label={messages.sessions.labels.updatedAt} value={formatDateTime(locale, data.updatedAt)} />
          <DetailItem label={messages.sessions.labels.notes} value={data.notes?.trim() ? data.notes : "-"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.sessions.labels.location}</CardTitle>
          <CardDescription>{messages.sessions.detailBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {buildingPaths.length === 0 ? (
            <p className="text-sm text-text-secondary">-</p>
          ) : (
            buildingPaths.map((pathLabel) => (
              <div
                key={pathLabel}
                className="rounded-3xl border border-border bg-surface-elevated px-4 py-4 text-sm text-text-primary"
              >
                {pathLabel}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.sessions.assignmentPlaceholder.title}</CardTitle>
          <CardDescription>{messages.sessions.assignmentPlaceholder.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href={`/sessions/${data.id}/assignments`}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-4 text-sm font-medium text-white shadow-panel transition-colors hover:bg-accent-hover"
          >
            {messages.sessions.openAssignmentsWorkspace}
          </Link>
          <Link
            href={`/sessions/${data.id}/waiting-list`}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-surface-elevated px-4 text-sm font-medium text-text-primary ring-1 ring-border transition-colors hover:bg-surface"
          >
            {messages.sessions.openWaitingListWorkspace}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
