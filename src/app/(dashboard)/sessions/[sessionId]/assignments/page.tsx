import { notFound } from "next/navigation";

import { SessionAssignmentsWorkspace } from "@/components/assignments/session-assignments-workspace";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";
import { getSessionById, SessionsServiceError } from "@/lib/sessions/service";
import { getDerivedSessionStatus } from "@/lib/sessions/status";
import { sessionRouteParamsSchema } from "@/lib/sessions/validation";

type SessionAssignmentsPageProps = {
  params: {
    sessionId: string;
  };
};

export default async function SessionAssignmentsPage({
  params
}: SessionAssignmentsPageProps) {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry",
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
      <SessionAssignmentsWorkspace
        locale={locale}
        messages={messages}
        session={{
          id: data.id,
          name: data.name,
          nameEn: data.nameEn,
          examType: data.examType,
          status: data.status,
          derivedStatus: getDerivedSessionStatus(data),
          isActive: data.isActive,
          buildings: data.buildings.map((buildingLink) => ({
            id: buildingLink.building.id,
            name: buildingLink.building.name,
            nameEn: buildingLink.building.nameEn
          }))
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
