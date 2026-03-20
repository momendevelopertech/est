import { NextResponse } from "next/server";

import { toImportTemplateListDTO } from "@/lib/import/templates/dto";
import {
  getRequestQuery,
  handleImportTemplateRouteError,
  requireImportTemplateApiRole
} from "@/lib/import/templates/http";
import { listImportTemplates } from "@/lib/import/templates/service";
import { importTemplateListQuerySchema } from "@/lib/import/templates/validation";

export async function GET(request: Request) {
  const auth = await requireImportTemplateApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = importTemplateListQuerySchema.parse(getRequestQuery(request));
    const result = await listImportTemplates(query);

    return NextResponse.json({
      ok: true,
      data: toImportTemplateListDTO(result)
    });
  } catch (error) {
    return handleImportTemplateRouteError(error);
  }
}
