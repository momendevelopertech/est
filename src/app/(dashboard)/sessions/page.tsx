import { SessionsWorkspace } from "@/components/sessions/sessions-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function SessionsPage() {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);
  const canManageStatus =
    session.user.role === "super_admin" || session.user.role === "coordinator";

  return (
    <SessionsWorkspace
      locale={locale}
      messages={messages}
      canManageStatus={canManageStatus}
    />
  );
}
