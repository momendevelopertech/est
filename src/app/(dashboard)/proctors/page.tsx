import { ProctorsDirectory } from "@/components/proctors/proctors-directory";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function ProctorsPage() {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return <ProctorsDirectory locale={locale} messages={messages} />;
}
