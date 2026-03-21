import { PremiumDashboard } from "@/components/dashboard/premium-dashboard";
import { requireSession } from "@/lib/auth/session";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function DashboardPage() {
  const session = await requireSession();
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return (
    <PremiumDashboard
      locale={locale}
      messages={messages}
      userRoleLabel={messages.roles[session.user.role]}
      canAccessTestGuide={
        session.user.role === "super_admin" || session.user.role === "coordinator"
      }
    />
  );
}
