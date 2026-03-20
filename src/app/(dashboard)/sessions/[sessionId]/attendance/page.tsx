import { notFound } from "next/navigation";

import { SessionAttendanceWorkspace } from "@/components/attendance/session-attendance-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";
import { getSessionById, SessionsServiceError } from "@/lib/sessions/service";
import { getDerivedSessionStatus } from "@/lib/sessions/status";
import { sessionRouteParamsSchema } from "@/lib/sessions/validation";

type SessionAttendancePageProps = {
  params: {
    sessionId: string;
  };
};

export default async function SessionAttendancePage({
  params
}: SessionAttendancePageProps) {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "senior"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  try {
    const routeParams = sessionRouteParamsSchema.parse(params);
    const data = await getSessionById(routeParams.sessionId, {
      includeInactive: true
    });

    return (
      <SessionAttendanceWorkspace
        locale={locale}
        messages={messages}
        session={{
          id: data.id,
          name: data.name,
          nameEn: data.nameEn,
          examType: data.examType,
          status: data.status,
          derivedStatus: getDerivedSessionStatus(data),
          isActive: data.isActive
        }}
      />
    );
  } catch (error) {
    if (error instanceof SessionsServiceError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
