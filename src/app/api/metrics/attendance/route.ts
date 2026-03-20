import { NextResponse } from "next/server";

import { toAttendanceMetricsDTO } from "@/lib/metrics/dto";
import {
  getRequestQuery,
  handleMetricsRouteError,
  requireMetricsApiRole
} from "@/lib/metrics/http";
import { getAttendanceMetrics } from "@/lib/metrics/service";
import { metricsQuerySchema } from "@/lib/metrics/validation";

export async function GET(request: Request) {
  const auth = await requireMetricsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = metricsQuerySchema.parse(getRequestQuery(request));
    const result = await getAttendanceMetrics({
      ...query,
      actorAppUserId: auth.session.user.id
    });

    return NextResponse.json({
      ok: true,
      data: toAttendanceMetricsDTO(result)
    });
  } catch (error) {
    return handleMetricsRouteError(error);
  }
}
