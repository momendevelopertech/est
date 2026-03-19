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
import type { getCycleById } from "@/lib/cycles/service";

type CycleDetailData = Awaited<ReturnType<typeof getCycleById>>;

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

export function CycleDetailView({
  data,
  locale,
  messages
}: {
  data: CycleDetailData;
  locale: Locale;
  messages: Messages;
}) {
  const cycleName = getLocalizedName(data, locale);
  const alternateName = getAlternateLocalizedName(data, locale);

  return (
    <div className="space-y-6">
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{messages.nav.cycles}</Badge>
            <Badge>{messages.cycles.statuses[data.status]}</Badge>
            <Badge>{data.isActive ? messages.cycles.labels.active : messages.cycles.labels.inactive}</Badge>
            {data.code ? <Badge>{`${messages.cycles.labels.code}: ${data.code}`}</Badge> : null}
          </div>
          <CardTitle className="text-3xl">{cycleName}</CardTitle>
          <CardDescription className="text-base">
            {alternateName ?? messages.cycles.detailBody}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              {messages.cycles.labels.dateRange}: {formatDate(locale, data.startDate)} -{" "}
              {formatDate(locale, data.endDate)}
            </p>
            <p>
              {messages.cycles.labels.updatedAt}: {formatDateTime(locale, data.updatedAt)}
            </p>
          </div>
          <Link
            href="/cycles"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-4 text-sm font-medium text-white shadow-panel transition-colors hover:bg-accent-hover"
          >
            {messages.cycles.detailBack}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.cycles.snapshotTitle}</CardTitle>
          <CardDescription>{messages.cycles.snapshotBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label={messages.cycles.labels.sessions} value={data._count.sessions} />
          <StatCard label={messages.cycles.labels.waitingList} value={data._count.waitingList} />
          <StatCard label={messages.cycles.labels.clonedCycles} value={data._count.clonedCycles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.cycles.detailTitle}</CardTitle>
          <CardDescription>{messages.cycles.detailBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailItem label={messages.cycles.labels.status} value={messages.cycles.statuses[data.status]} />
          <DetailItem label={messages.cycles.labels.startDate} value={formatDate(locale, data.startDate)} />
          <DetailItem label={messages.cycles.labels.endDate} value={formatDate(locale, data.endDate)} />
          <DetailItem
            label={messages.cycles.labels.cloneMode}
            value={data.cloneMode ? messages.cycles.cloneModes[data.cloneMode] : "-"}
          />
          <DetailItem
            label={messages.cycles.labels.sourceCycle}
            value={data.sourceCycle ? getLocalizedName(data.sourceCycle, locale) : "-"}
          />
          <DetailItem
            label={messages.cycles.labels.updatedAt}
            value={formatDateTime(locale, data.updatedAt)}
          />
          <DetailItem
            label={messages.cycles.labels.notes}
            value={data.notes?.trim() ? data.notes : "-"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
