import { toSessionExportFileDTO } from "@/lib/export/dto";
import {
  getRequestQuery,
  handleExportRouteError,
  requireExportApiRole
} from "@/lib/export/http";
import { generateAssignmentsSessionExport } from "@/lib/export/service";
import { sessionExportQuerySchema } from "@/lib/export/validation";

export async function GET(request: Request) {
  const auth = await requireExportApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = sessionExportQuerySchema.parse(getRequestQuery(request));
    const result = await generateAssignmentsSessionExport({
      ...query,
      format: query.format ?? "csv",
      locale: query.locale ?? "en",
      actorAppUserId: auth.session.user.id
    });
    const dto = toSessionExportFileDTO(result);

    return new Response(dto.content, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename=\"${result.fileName}\"`,
        "Cache-Control": "no-store",
        "X-Export-Type": String(dto.exportType),
        "X-Export-Format": String(dto.format),
        "X-Export-Session-Id": String(dto.sessionId),
        "X-Export-Row-Count": String(dto.rowCount),
        "X-Export-Duplicates-Removed": String(dto.duplicateRowsRemoved),
        "X-Export-Generated-At": String(dto.generatedAt)
      }
    });
  } catch (error) {
    return handleExportRouteError(error);
  }
}
