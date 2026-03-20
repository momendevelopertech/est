import { ReportsHub } from "@/components/reports/reports-hub";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function ReportsHubPage() {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry",
    "senior",
    "viewer"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return <ReportsHub locale={locale} messages={messages} />;
}
