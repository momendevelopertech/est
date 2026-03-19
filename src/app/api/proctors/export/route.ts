import { resolveRequestLocale } from "@/lib/i18n";
import { exportProctors } from "@/lib/proctors/export";
import {
  getRequestQuery,
  handleProctorRouteError,
  requireProctorsApiRole
} from "@/lib/proctors/http";
import { proctorExportQuerySchema } from "@/lib/proctors/validation";

export async function GET(request: Request) {
  const auth = await requireProctorsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = proctorExportQuerySchema.parse(getRequestQuery(request));
    const locale =
      query.locale ?? (await resolveRequestLocale(auth.session.user.preferredLanguage));
    const result = await exportProctors({
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
    return handleProctorRouteError(error);
  }
}
