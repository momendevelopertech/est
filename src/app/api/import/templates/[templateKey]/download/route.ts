import {
  getRequestQuery,
  handleImportTemplateRouteError,
  requireImportTemplateApiRole
} from "@/lib/import/templates/http";
import { downloadImportTemplate } from "@/lib/import/templates/service";
import {
  importTemplateDownloadQuerySchema,
  importTemplateRouteParamsSchema
} from "@/lib/import/templates/validation";

type RouteParams = {
  params: {
    templateKey: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireImportTemplateApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const parsedParams = importTemplateRouteParamsSchema.parse(params);
    const parsedQuery = importTemplateDownloadQuerySchema.parse(
      getRequestQuery(request)
    );
    const result = await downloadImportTemplate({
      templateKey: parsedParams.templateKey,
      locale: parsedQuery.locale ?? "en",
      withSample: parsedQuery.withSample ?? false,
      actorAppUserId: auth.session.user.id
    });

    return new Response(result.content, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename=\"${result.fileName}\"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return handleImportTemplateRouteError(error);
  }
}
