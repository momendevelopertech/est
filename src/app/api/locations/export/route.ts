import { resolveRequestLocale } from "@/lib/i18n";
import { exportLocations } from "@/lib/locations/export";
import {
  getRequestQuery,
  handleLocationRouteError,
  requireLocationsApiRole
} from "@/lib/locations/http";
import { locationExportQuerySchema } from "@/lib/locations/validation";

export async function GET(request: Request) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = locationExportQuerySchema.parse(getRequestQuery(request));
    const locale =
      query.locale ?? (await resolveRequestLocale(auth.session.user.preferredLanguage));
    const result = await exportLocations({
      ...query,
      locale
    });

    return new Response(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}
