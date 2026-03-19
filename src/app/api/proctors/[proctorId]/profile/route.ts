import { NextResponse } from "next/server";

import { requireProctorsApiRole, handleProctorRouteError } from "@/lib/proctors/http";
import { getProctorProfile } from "@/lib/proctors/service";
import {
  proctorDetailQuerySchema,
  proctorRouteParamsSchema
} from "@/lib/proctors/validation";
import { getRequestQuery } from "@/lib/proctors/http";

type RouteParams = {
  params: {
    proctorId: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireProctorsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = proctorRouteParamsSchema.parse(params);
    const query = proctorDetailQuerySchema.parse(getRequestQuery(request));
    const data = await getProctorProfile(routeParams.proctorId, {
      includeInactive: query.includeInactive
    });

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleProctorRouteError(error);
  }
}
