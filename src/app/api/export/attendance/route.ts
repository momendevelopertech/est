import {
  getRequestQuery,
  handleExportRouteError,
  requireExportApiRole
} from "@/lib/export/http";
import { generateAttendanceSessionExport } from "@/lib/export/service";
import { sessionExportQuerySchema } from "@/lib/export/validation";

export async function GET(request: Request) {
  const auth = await requireExportApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = sessionExportQuerySchema.parse(getRequestQuery(request));
    const result = await generateAttendanceSessionExport({
      ...query,
      format: query.format ?? "csv",
      locale: query.locale ?? "en",
      actorAppUserId: auth.session.user.id
    });
    const body =
      typeof result.content === "string"
        ? result.content
        : new Blob([Uint8Array.from(result.content)], {
            type: result.contentType
          });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename=\"${result.fileName}\"`,
        "Cache-Control": "no-store",
        "X-Export-Type": String(result.exportType),
        "X-Export-Format": String(result.format),
        "X-Export-Session-Id": String(result.sessionId),
        "X-Export-Row-Count": String(result.rowCount),
        "X-Export-Duplicates-Removed": String(result.duplicateRowsRemoved),
        "X-Export-Generated-At": result.generatedAt.toISOString()
      }
    });
  } catch (error) {
    return handleExportRouteError(error);
  }
}
