import { requireRole } from "@/lib/auth/guards";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

import { LocationsTree } from "@/components/locations/locations-tree";

export default async function LocationsPage() {
  const session = await requireRole([
    "super_admin",
    "coordinator",
    "data_entry"
  ]);
  const locale = await resolveRequestLocale(session.user.preferredLanguage);
  const messages = getMessages(locale);

  return <LocationsTree locale={locale} messages={messages} />;
}
