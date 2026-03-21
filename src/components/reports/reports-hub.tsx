import { Badge } from "@/components/ui/badge";
import { ActionLink } from "@/components/ui/action-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { PageHero } from "@/components/ui/page-hero";
import type { Locale, Messages } from "@/lib/i18n";

type ReportsHubProps = {
  locale: Locale;
  messages: Messages;
};

const reportLinks = [
  {
    key: "assignments",
    href: "/reports/assignments"
  },
  {
    key: "attendance",
    href: "/reports/attendance"
  },
  {
    key: "evaluations",
    href: "/reports/evaluations"
  }
] as const;

export function ReportsHub({ locale, messages }: ReportsHubProps) {
  const isArabic = locale === "ar";

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.nav.reports }
        ]}
        title={messages.reports.hub.title}
        description={messages.reports.hub.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.common.foundation}
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-text-primary">
              {messages.reports.hub.openReport}
            </p>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportLinks.map((item) => {
          const section = messages.reports.pages[item.key];

          return (
            <Card key={item.key}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <Badge variant="accent">
                  {isArabic ? messages.common.rtl : messages.common.ltr}
                </Badge>
                <ActionLink href={item.href} variant="primary">
                  {messages.reports.hub.openReport}
                </ActionLink>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
