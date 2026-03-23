import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { PageHero } from "@/components/ui/page-hero";
import type { Messages, Locale } from "@/lib/i18n";
import { getAlternateLocalizedName, getLocalizedName } from "@/lib/i18n/presentation";
import { getProctorOperationalRoleLabel } from "@/lib/proctors/operational-role";
import type { getProctorProfile } from "@/lib/proctors/service";

type ProctorProfileData = Awaited<ReturnType<typeof getProctorProfile>>;

function formatDate(locale: Locale, value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateOnly(locale: Locale, value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium"
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
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-text-primary">{value}</p>
    </div>
  );
}

function StatCard({
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

function toPreferredLanguageLabel(locale: Locale, messages: Messages, value: "AR" | "EN" | null) {
  if (value === "AR") {
    return messages.common.arabic;
  }

  if (value === "EN") {
    return messages.common.english;
  }

  return locale === "ar" ? "-" : "-";
}

export function ProctorProfileView({
  data,
  locale,
  messages
}: {
  data: ProctorProfileData;
  locale: Locale;
  messages: Messages;
}) {
  const profileLabel = getLocalizedName(data, locale);
  const alternateLabel = getAlternateLocalizedName(data, locale);

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.nav.proctors, variant: "accent" },
          { label: data.isActive ? messages.proctors.labels.active : messages.proctors.labels.inactive },
          { label: messages.proctors.sources[data.source] },
          { label: getProctorOperationalRoleLabel(data.operationalRole, locale) },
          { label: messages.proctors.blockStatuses[data.blockStatus] }
        ]}
        title={profileLabel}
        description={alternateLabel ?? messages.proctors.profile.subtitle}
        body={
          <div className="max-w-3xl space-y-2">
            <p className="text-sm leading-7 text-text-secondary">
              {data.notes ?? messages.proctors.noNotes}
            </p>
            <p className="text-sm text-text-secondary">
              {messages.proctors.labels.phone}: {data.phone}
            </p>
          </div>
        }
        actions={<ActionLink href="/proctors">{messages.proctors.profile.backToDirectory}</ActionLink>}
      />

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.profile.summaryTitle}</CardTitle>
          <CardDescription>{messages.proctors.profile.summaryBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label={messages.proctors.profile.stats.totalSessions}
            value={data.summary.totalSessions}
          />
          <StatCard
            label={messages.proctors.profile.stats.averageRating}
            value={data.summary.averageRating}
          />
          <StatCard
            label={messages.proctors.profile.stats.assignments}
            value={data.summary.assignments}
          />
          <StatCard
            label={messages.proctors.profile.stats.attendance}
            value={data.summary.attendance}
          />
          <StatCard
            label={messages.proctors.profile.stats.evaluations}
            value={data.summary.evaluations}
          />
          <StatCard
            label={messages.proctors.profile.stats.blocks}
            value={data.summary.blocks}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.profile.overviewTitle}</CardTitle>
          <CardDescription>{messages.proctors.profile.overviewBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailItem label={messages.proctors.labels.email} value={data.email ?? "-"} />
          <DetailItem
            label={messages.proctors.labels.nationalId}
            value={data.nationalId ?? "-"}
          />
          <DetailItem
            label={locale === "ar" ? "الرول التشغيلية" : "Operational role"}
            value={getProctorOperationalRoleLabel(data.operationalRole, locale)}
          />
          <DetailItem
            label={messages.proctors.labels.organization}
            value={data.organization ?? "-"}
          />
          <DetailItem label={messages.proctors.labels.branch} value={data.branch ?? "-"} />
          <DetailItem
            label={messages.proctors.labels.governorate}
            value={data.governorate ? getLocalizedName(data.governorate, locale) : "-"}
          />
          <DetailItem
            label={messages.proctors.labels.preferredLanguage}
            value={toPreferredLanguageLabel(locale, messages, data.preferredLanguage)}
          />
          <DetailItem
            label={messages.proctors.labels.blockEndsAt}
            value={formatDate(locale, data.blockEndsAt)}
          />
          <DetailItem
            label={messages.proctors.labels.updatedAt}
            value={formatDate(locale, data.updatedAt)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.profile.assignmentsTitle}</CardTitle>
          <CardDescription>{messages.proctors.profile.assignmentsBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.history.assignments.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {messages.proctors.profile.emptyAssignments}
            </p>
          ) : (
            data.history.assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="rounded-3xl border border-border bg-surface-elevated px-4 py-4"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge>{messages.proctors.assignmentStatuses[assignment.status]}</Badge>
                  <Badge>{messages.proctors.assignmentMethods[assignment.assignedMethod]}</Badge>
                  {assignment.attendance ? (
                    <Badge>{messages.proctors.attendanceStatuses[assignment.attendance.status]}</Badge>
                  ) : null}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-text-primary">
                  {getLocalizedName(assignment.session, locale)}
                </h3>
                <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
                  <p>
                    {messages.proctors.profile.labels.examType}:{" "}
                    {messages.proctors.examTypes[assignment.session.examType]}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.role}:{" "}
                    {getLocalizedName(assignment.roleDefinition, locale)}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.sessionDate}:{" "}
                    {formatDateOnly(locale, assignment.session.sessionDate)}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.assignedAt}:{" "}
                    {formatDate(locale, assignment.assignedAt)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  {messages.proctors.profile.labels.location}:{" "}
                  {[
                    assignment.building ? getLocalizedName(assignment.building, locale) : null,
                    assignment.floor ? getLocalizedName(assignment.floor, locale) : null,
                    assignment.room ? getLocalizedName(assignment.room, locale) : null
                  ]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </p>
                {assignment.overrideNote ? (
                  <p className="mt-2 text-sm text-text-secondary">{assignment.overrideNote}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.profile.attendanceTitle}</CardTitle>
          <CardDescription>{messages.proctors.profile.attendanceBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.history.attendance.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {messages.proctors.profile.emptyAttendance}
            </p>
          ) : (
            data.history.attendance.map((entry) => {
              const attendance = entry.attendance;

              if (!attendance) {
                return null;
              }

              return (
                <div
                  key={attendance.id}
                  className="rounded-3xl border border-border bg-surface-elevated px-4 py-4"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge>{messages.proctors.attendanceStatuses[attendance.status]}</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-text-primary">
                    {getLocalizedName(entry.session, locale)}
                  </h3>
                  <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
                    <p>
                      {messages.proctors.profile.labels.checkedInAt}:{" "}
                      {formatDate(locale, attendance.checkedInAt)}
                    </p>
                    <p>
                      {messages.proctors.profile.labels.updatedBy}:{" "}
                      {attendance.updatedByAppUser?.displayName ?? "-"}
                    </p>
                    <p>
                      {messages.proctors.profile.labels.recordedAt}:{" "}
                      {formatDate(locale, attendance.updatedAt)}
                    </p>
                    <p>
                      {messages.proctors.profile.labels.assignmentId}: {entry.assignmentId}
                    </p>
                  </div>
                  {attendance.notes ? (
                    <p className="mt-2 text-sm text-text-secondary">{attendance.notes}</p>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.profile.evaluationsTitle}</CardTitle>
          <CardDescription>{messages.proctors.profile.evaluationsBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.history.evaluations.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {messages.proctors.profile.emptyEvaluations}
            </p>
          ) : (
            data.history.evaluations.map((evaluation) => (
              <div
                key={evaluation.id}
                className="rounded-3xl border border-border bg-surface-elevated px-4 py-4"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge>{messages.proctors.profile.labels.score}: {evaluation.score.toString()}</Badge>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-text-primary">
                  {getLocalizedName(evaluation.session, locale)}
                </h3>
                <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
                  <p>
                    {messages.proctors.profile.labels.evaluator}:{" "}
                    {evaluation.evaluatorAppUser.displayName}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.examType}:{" "}
                    {messages.proctors.examTypes[evaluation.session.examType]}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.sessionDate}:{" "}
                    {formatDateOnly(locale, evaluation.session.sessionDate)}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.recordedAt}:{" "}
                    {formatDate(locale, evaluation.createdAt)}
                  </p>
                </div>
                {evaluation.notes ? (
                  <p className="mt-2 text-sm text-text-secondary">{evaluation.notes}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.proctors.profile.blocksTitle}</CardTitle>
          <CardDescription>{messages.proctors.profile.blocksBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.history.blocks.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {messages.proctors.profile.emptyBlocks}
            </p>
          ) : (
            data.history.blocks.map((block) => (
              <div
                key={block.id}
                className="rounded-3xl border border-border bg-surface-elevated px-4 py-4"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge>{messages.proctors.blockTypes[block.type]}</Badge>
                  <Badge>{messages.proctors.blockRecordStatuses[block.status]}</Badge>
                  <Badge>{messages.proctors.blockSources[block.source]}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
                  <p>
                    {messages.proctors.profile.labels.startsAt}:{" "}
                    {formatDate(locale, block.startsAt)}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.endsAt}: {formatDate(locale, block.endsAt)}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.createdBy}:{" "}
                    {block.createdByAppUser?.displayName ?? "-"}
                  </p>
                  <p>
                    {messages.proctors.profile.labels.liftedBy}:{" "}
                    {block.liftedByAppUser?.displayName ?? "-"}
                  </p>
                </div>
                {block.reason ? (
                  <p className="mt-2 text-sm text-text-secondary">{block.reason}</p>
                ) : null}
                {block.liftReason ? (
                  <p className="mt-2 text-sm text-text-secondary">{block.liftReason}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
