import { NextResponse } from "next/server";

import { toSessionDTO } from "@/lib/sessions/dto";
import {
  getRequestQuery,
  handleSessionRouteError,
  readJsonBody,
  requireSessionsApiRole
} from "@/lib/sessions/http";
import { createSession, getSessions } from "@/lib/sessions/service";
import {
  createSessionSchema,
  sessionListQuerySchema
} from "@/lib/sessions/validation";

export async function GET(request: Request) {
  const auth = await requireSessionsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = sessionListQuerySchema.parse(getRequestQuery(request));
    const result = await getSessions(query);

    return NextResponse.json({
      ok: true,
      data: result.data.map((session) => toSessionDTO(session)),
      pagination: result.pagination
    });
  } catch (error) {
    return handleSessionRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireSessionsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createSessionSchema.parse(body);
    const data = await createSession(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        data: toSessionDTO(data)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleSessionRouteError(error);
  }
}
