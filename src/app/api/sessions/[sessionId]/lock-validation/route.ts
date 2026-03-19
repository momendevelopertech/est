import { NextResponse } from "next/server";

import {
  handleAssignmentRouteError,
  requireAssignmentsApiRole
} from "@/lib/assignments/http";
import { validateSessionPreLock } from "@/lib/assignments/service";
import { serializeForApi } from "@/lib/dto/serialize";
import { sessionRouteParamsSchema } from "@/lib/sessions/validation";

type RouteParams = {
  params: {
    sessionId: string;
  };
};

export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAssignmentsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = sessionRouteParamsSchema.parse(params);
    const data = await validateSessionPreLock(routeParams.sessionId);

    return NextResponse.json({
      ok: true,
      data: serializeForApi(data)
    });
  } catch (error) {
    return handleAssignmentRouteError(error);
  }
}
