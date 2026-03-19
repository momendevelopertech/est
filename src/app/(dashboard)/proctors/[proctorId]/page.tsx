import { notFound } from "next/navigation";

import { ProctorProfileView } from "@/components/proctors/proctor-profile-view";
import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";
import { ProctorsServiceError, getProctorProfile } from "@/lib/proctors/service";
import { proctorRouteParamsSchema } from "@/lib/proctors/validation";

type ProctorProfilePageProps = {
  params: {
    proctorId: string;
  };
};

export default async function ProctorProfilePage({
  params
}: ProctorProfilePageProps) {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  try {
    const routeParams = proctorRouteParamsSchema.parse(params);
    const data = await getProctorProfile(routeParams.proctorId, {
      includeInactive: true
    });

    return <ProctorProfileView data={data} locale={locale} messages={messages} />;
  } catch (error) {
    if (error instanceof ProctorsServiceError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
