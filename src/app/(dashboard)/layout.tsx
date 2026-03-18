import { AppShell } from "@/components/app-shell/shell";
import { requireSession } from "@/lib/auth/session";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return (
    <AppShell locale={locale} messages={messages} user={session.user}>
      {children}
    </AppShell>
  );
}
