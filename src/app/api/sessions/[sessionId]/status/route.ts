import { NextResponse } from "next/server";

import { toSessionDTO } from "@/lib/sessions/dto";
import {
  handleSessionRouteError,
  readJsonBody,
  requireSessionStatusApiRole
} from "@/lib/sessions/http";
import { updateSessionStatus } from "@/lib/sessions/service";
import {
  sessionRouteParamsSchema,
  updateSessionStatusSchema
} from "@/lib/sessions/validation";

type RouteParams = {
  params: {
    sessionId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireSessionStatusApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = sessionRouteParamsSchema.parse(params);
    const body = await readJsonBody(request);
    const input = updateSessionStatusSchema.parse(body);
    const data = await updateSessionStatus(
      routeParams.sessionId,
      input,
      auth.session.user.id
    );

    return NextResponse.json({
      ok: true,
      data: toSessionDTO(data)
    });
  } catch (error) {
    return handleSessionRouteError(error);
  }
}
