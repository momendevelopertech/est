import Link from "next/link";

import { OperationalResetCard } from "@/components/settings/operational-reset-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function SettingsPage() {
  const session = await requireRole(["super_admin", "coordinator"]);

  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);
  const items = Object.values(messages.settings.items);
  const canResetOperationalData = session.user.role === "super_admin";

  return (
    <div className="space-y-4">
      <Card className="panel border-transparent px-6 py-6">
        <CardHeader>
          <CardTitle className="text-3xl">{messages.settings.title}</CardTitle>
          <CardDescription className="text-base">
            {messages.settings.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/settings/import-templates"
              className="motion-button inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-4 text-sm font-medium text-white shadow-panel transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {messages.importTemplates.open}
            </Link>
            <Link
              href="/settings/notifications"
              className="motion-button inline-flex h-11 items-center justify-center rounded-2xl bg-surface-elevated px-4 text-sm font-medium text-text-primary ring-1 ring-border transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {messages.notificationPreferences.actions.open}
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardDescription>{item}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {canResetOperationalData ? (
        <OperationalResetCard copy={messages.settings.operationalReset} />
      ) : null}
    </div>
  );
}
