import { NotificationPreferencesWorkspace } from "@/components/notifications/notification-preferences-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function NotificationSettingsPage() {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry",
    "senior",
    "viewer"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return <NotificationPreferencesWorkspace locale={locale} messages={messages} />;
}
