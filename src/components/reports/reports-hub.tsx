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
      <Card className="panel border-transparent px-6 py-6 sm:px-8">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{messages.nav.reports}</Badge>
          </div>
          <CardTitle className="text-3xl">{messages.reports.hub.title}</CardTitle>
          <CardDescription className="text-base">
            {messages.reports.hub.subtitle}
          </CardDescription>
        </CardHeader>
      </Card>

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
                <Link
                  href={item.href}
                  className="motion-button inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-4 text-sm font-medium text-white shadow-panel transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {messages.reports.hub.openReport}
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
