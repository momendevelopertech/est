import { NextResponse } from "next/server";
import { z } from "zod";

import { toSessionDTO } from "@/lib/sessions/dto";
import {
  getRequestQuery,
  handleSessionRouteError,
  readJsonBody,
  requireSessionsApiRole
} from "@/lib/sessions/http";
import {
  deactivateSession,
  getSessionById,
  permanentlyDeleteSession,
  updateSession
} from "@/lib/sessions/service";
import {
  sessionDetailQuerySchema,
  sessionRouteParamsSchema,
  updateSessionSchema
} from "@/lib/sessions/validation";

type RouteParams = {
  params: {
    sessionId: string;
  };
};

const sessionDeleteQuerySchema = z.object({
  mode: z.enum(["deactivate", "hard"]).optional().default("deactivate")
});

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireSessionsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = sessionRouteParamsSchema.parse(params);
    const query = sessionDetailQuerySchema.parse(getRequestQuery(request));
    const data = await getSessionById(routeParams.sessionId, {
      includeInactive: query.includeInactive
    });

    return NextResponse.json({
      ok: true,
      data: toSessionDTO(data)
    });
  } catch (error) {
    return handleSessionRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireSessionsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = sessionRouteParamsSchema.parse(params);
    const body = await readJsonBody(request);
    const input = updateSessionSchema.parse(body);
    const data = await updateSession(routeParams.sessionId, input, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: toSessionDTO(data)
    });
  } catch (error) {
    return handleSessionRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireSessionsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = sessionRouteParamsSchema.parse(params);
    const query = sessionDeleteQuerySchema.parse(getRequestQuery(request));
    const data =
      query.mode === "hard"
        ? await permanentlyDeleteSession(routeParams.sessionId, auth.session.user.id)
        : await deactivateSession(routeParams.sessionId, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: toSessionDTO(data)
    });
  } catch (error) {
    return handleSessionRouteError(error);
  }
}
