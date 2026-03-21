import Link from "next/link";

import { PageHero } from "@/components/ui/page-hero";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { Locale, Messages } from "@/lib/i18n";

type TestGuideWorkspaceProps = {
  locale: Locale;
  messages: Messages;
  englishMessages: Messages;
  arabicMessages: Messages;
};

const guideGroups = [
  {
    key: "access",
    sections: ["gettingStarted", "login", "dashboard"]
  },
  {
    key: "setup",
    sections: ["locations", "proctors", "cyclesSessions"]
  },
  {
    key: "operations",
    sections: [
      "assignments",
      "waitingList",
      "swap",
      "attendance",
      "evaluation",
      "promotion",
      "blocks"
    ]
  },
  {
    key: "oversight",
    sections: ["reportsExport", "notifications"]
  },
  {
    key: "quality",
    sections: ["commonErrors", "bestPractices"]
  }
] as const;

type SectionKey = (typeof guideGroups)[number]["sections"][number];
type GuideSection = Messages["testGuide"]["sections"][SectionKey];
type GuideLabels = Messages["testGuide"]["labels"];

const sectionStatuses: Record<
  SectionKey,
  Array<"liveChecked" | "seededRuntime" | "productionBlocker" | "codeVerified">
> = {
  gettingStarted: ["liveChecked", "seededRuntime", "productionBlocker"],
  login: ["liveChecked", "seededRuntime", "productionBlocker"],
  dashboard: ["liveChecked", "seededRuntime"],
  locations: ["seededRuntime", "codeVerified"],
  proctors: ["seededRuntime", "codeVerified"],
  cyclesSessions: ["seededRuntime", "codeVerified"],
  assignments: ["seededRuntime", "codeVerified"],
  waitingList: ["seededRuntime", "codeVerified"],
  swap: ["seededRuntime", "codeVerified"],
  attendance: ["seededRuntime", "codeVerified"],
  evaluation: ["seededRuntime", "codeVerified"],
  promotion: ["seededRuntime", "codeVerified"],
  blocks: ["seededRuntime", "codeVerified"],
  reportsExport: ["seededRuntime", "codeVerified"],
  notifications: ["seededRuntime", "codeVerified"],
  commonErrors: ["liveChecked", "seededRuntime", "codeVerified"],
  bestPractices: ["seededRuntime", "codeVerified"]
};

function getBadgeVariant(
  key: "liveChecked" | "seededRuntime" | "productionBlocker" | "codeVerified"
) {
  if (key === "productionBlocker") {
    return "warning" as const;
  }

  if (key === "seededRuntime") {
    return "success" as const;
  }

  return "accent" as const;
}

function LanguagePanel({
  dir,
  lang,
  label,
  labels,
  section
}: {
  dir: "ltr" | "rtl";
  lang: "en" | "ar";
  label: string;
  labels: GuideLabels;
  section: GuideSection;
}) {
  return (
    <div
      dir={dir}
      lang={lang}
      className={`rounded-3xl border border-border bg-surface px-4 py-4 ${
        lang === "ar" ? "font-arabic text-right" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <Badge>{lang.toUpperCase()}</Badge>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
            {labels.purpose}
          </p>
          <p className="text-sm leading-7 text-text-primary">{section.purpose}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
            {labels.steps}
          </p>
          <ol className="space-y-2 text-sm leading-7 text-text-primary">
            {section.steps.map((step, index) => (
              <li key={`${lang}-${index}`} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-text-secondary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
            {labels.expected}
          </p>
          <p className="text-sm leading-7 text-text-primary">{section.expected}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">
            {labels.notes}
          </p>
          <ul className="space-y-2 text-sm leading-7 text-text-primary">
            {section.notes.map((note, index) => (
              <li key={`${lang}-note-${index}`} className="flex gap-3">
                <span className="mt-[0.72rem] h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function TestGuideWorkspace({
  locale,
  messages,
  englishMessages,
  arabicMessages
}: TestGuideWorkspaceProps) {
  const isArabic = locale === "ar";

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.testGuide.badges.adminOnly, variant: "warning" },
          { label: messages.nav.testGuide }
        ]}
        title={messages.testGuide.title}
        description={messages.testGuide.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.testGuide.productionUrlLabel}
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-text-primary">
              {messages.testGuide.badges.adminOnly}
            </p>
          </>
        }
        body={
          <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
            <span>{messages.testGuide.productionUrlLabel}</span>
            <Link
              href={messages.testGuide.productionUrl}
              className="text-accent underline underline-offset-4"
            >
              {messages.testGuide.productionUrl}
            </Link>
          </div>
          <p className="max-w-4xl text-sm leading-7 text-text-secondary">
            {messages.testGuide.intro}
          </p>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {(["live", "local", "rules"] as const).map((key) => {
          const section = messages.testGuide.overview[key];

          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.body}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm leading-7 text-text-primary">
                  {section.items.map((item, index) => (
                    <li key={`${key}-${index}`} className="flex gap-3">
                      <span className="mt-[0.72rem] h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {guideGroups.map((group) => {
        const groupMessages = messages.testGuide.groups[group.key];

        return (
          <section key={group.key} className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{groupMessages.eyebrow}</Badge>
                <Badge>{messages.nav.testGuide}</Badge>
              </div>
              <h2 className="text-2xl font-semibold text-text-primary">
                {groupMessages.title}
              </h2>
              <p className="max-w-4xl text-sm leading-7 text-text-secondary">
                {groupMessages.description}
              </p>
            </div>

            <div className="space-y-4">
              {group.sections.map((sectionKey, index) => {
                const currentSection = messages.testGuide.sections[sectionKey];
                const englishSection = englishMessages.testGuide.sections[sectionKey];
                const arabicSection = arabicMessages.testGuide.sections[sectionKey];

                return (
                  <details
                    key={sectionKey}
                    open={index === 0}
                    className="rounded-panel border border-border bg-surface px-5 py-5 shadow-panel"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {sectionStatuses[sectionKey].map((statusKey) => (
                              <Badge
                                key={statusKey}
                                variant={getBadgeVariant(statusKey)}
                              >
                                {messages.testGuide.badges[statusKey]}
                              </Badge>
                            ))}
                          </div>
                          <h3 className="text-xl font-semibold text-text-primary">
                            {currentSection.title}
                          </h3>
                          <p className="max-w-3xl text-sm leading-7 text-text-secondary">
                            {currentSection.summary}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-text-secondary">
                          /{sectionKey}
                        </span>
                      </div>
                    </summary>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <LanguagePanel
                        dir="ltr"
                        lang="en"
                        label={englishMessages.testGuide.labels.english}
                        labels={englishMessages.testGuide.labels}
                        section={englishSection}
                      />
                      <LanguagePanel
                        dir="rtl"
                        lang="ar"
                        label={arabicMessages.testGuide.labels.arabic}
                        labels={arabicMessages.testGuide.labels}
                        section={arabicSection}
                      />
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>{messages.testGuide.footer.title}</CardTitle>
          <CardDescription>{messages.testGuide.footer.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="motion-button inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-4 text-sm font-medium text-white shadow-panel transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {messages.testGuide.footer.backToDashboard}
          </Link>
          <Link
            href="/reports"
            className="motion-button inline-flex h-11 items-center justify-center rounded-2xl bg-surface-elevated px-4 text-sm font-medium text-text-primary ring-1 ring-border transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {messages.dashboard.workspace.actions.openReports}
          </Link>
          <Badge variant={isArabic ? "success" : "accent"}>
            {isArabic ? messages.common.rtl : messages.common.ltr}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
