import { TestGuideWorkspace } from "@/components/test-guide/test-guide-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function TestGuidePage() {
  const session = await requireRole(["super_admin", "coordinator"]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return <TestGuideWorkspace locale={locale} messages={messages} />;
}
