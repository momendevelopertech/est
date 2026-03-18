import { NextResponse } from "next/server";

import {
  createProctor,
  listProctors
} from "@/lib/proctors/service";
import {
  getRequestQuery,
  handleProctorRouteError,
  readJsonBody,
  requireProctorsApiRole
} from "@/lib/proctors/http";
import {
  createProctorSchema,
  proctorListQuerySchema
} from "@/lib/proctors/validation";

export async function GET(request: Request) {
  const auth = await requireProctorsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = proctorListQuerySchema.parse(getRequestQuery(request));
    const data = await listProctors(query);

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleProctorRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireProctorsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createProctorSchema.parse(body);
    const data = await createProctor(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        data
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleProctorRouteError(error);
  }
}
