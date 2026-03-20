import { ReportSummaryWorkspace } from "@/components/reports/report-summary-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

export default async function EvaluationsReportPage() {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry",
    "senior",
    "viewer"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return (
    <ReportSummaryWorkspace
      locale={locale}
      messages={messages}
      reportType="evaluations"
    />
  );
}
