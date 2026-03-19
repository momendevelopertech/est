import { notFound } from "next/navigation";

import { CycleDetailView } from "@/components/cycles/cycle-detail-view";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";
import { CyclesServiceError, getCycleById } from "@/lib/cycles/service";
import { cycleRouteParamsSchema } from "@/lib/cycles/validation";

type CycleDetailPageProps = {
  params: {
    cycleId: string;
  };
};

export default async function CycleDetailPage({ params }: CycleDetailPageProps) {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  try {
    const routeParams = cycleRouteParamsSchema.parse(params);
    const data = await getCycleById(routeParams.cycleId, {
      includeInactive: true
    });

    return <CycleDetailView data={data} locale={locale} messages={messages} />;
  } catch (error) {
    if (error instanceof CyclesServiceError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
