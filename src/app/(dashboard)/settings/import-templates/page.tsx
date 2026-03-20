import { ImportTemplatesWorkspace } from "@/components/import-templates/import-templates-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function ImportTemplatesPage() {
  const session = await requireRole(["super_admin", "coordinator"]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return <ImportTemplatesWorkspace locale={locale} messages={messages} />;
}
