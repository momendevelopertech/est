import { NextResponse } from "next/server";

import { toReportSummaryDTO } from "@/lib/reports/dto";
import {
  getRequestQuery,
  handleReportsRouteError,
  requireReportsApiRole
} from "@/lib/reports/http";
import { getEvaluationsReportSummary } from "@/lib/reports/service";
import { reportQuerySchema } from "@/lib/reports/validation";

export async function GET(request: Request) {
  const auth = await requireReportsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = reportQuerySchema.parse(getRequestQuery(request));
    const result = await getEvaluationsReportSummary({
      ...query,
      actorAppUserId: auth.session.user.id
    });

    return NextResponse.json({
      ok: true,
      data: toReportSummaryDTO(result)
    });
  } catch (error) {
    return handleReportsRouteError(error);
  }
}
