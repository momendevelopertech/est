import { notFound } from "next/navigation";

import { SessionDetailView } from "@/components/sessions/session-detail-view";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";
import { getSessionById, SessionsServiceError } from "@/lib/sessions/service";
import { sessionRouteParamsSchema } from "@/lib/sessions/validation";

type SessionDetailPageProps = {
  params: {
    sessionId: string;
  };
};

export default async function SessionDetailPage({
  params
}: SessionDetailPageProps) {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  try {
    const routeParams = sessionRouteParamsSchema.parse(params);
    const data = await getSessionById(routeParams.sessionId, {
      includeInactive: true
    });

    return <SessionDetailView data={data} locale={locale} messages={messages} />;
  } catch (error) {
    if (error instanceof SessionsServiceError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
