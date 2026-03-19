import { NextResponse } from "next/server";

import { toProctorDTO } from "@/lib/proctors/dto";
import {
  deactivateProctor,
  getProctor,
  updateProctor
} from "@/lib/proctors/service";
import {
  getRequestQuery,
  handleProctorRouteError,
  readJsonBody,
  requireProctorsApiRole
} from "@/lib/proctors/http";
import {
  proctorDetailQuerySchema,
  proctorRouteParamsSchema,
  updateProctorSchema
} from "@/lib/proctors/validation";

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
    const data = await getProctor(routeParams.proctorId, {
      includeInactive: query.includeInactive
    });

    return NextResponse.json({
      ok: true,
      data: toProctorDTO(data)
    });
  } catch (error) {
    return handleProctorRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireProctorsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = proctorRouteParamsSchema.parse(params);
    const body = await readJsonBody(request);
    const input = updateProctorSchema.parse(body);
    const data = await updateProctor(routeParams.proctorId, input, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: toProctorDTO(data)
    });
  } catch (error) {
    return handleProctorRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireProctorsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = proctorRouteParamsSchema.parse(params);
    const data = await deactivateProctor(routeParams.proctorId, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: toProctorDTO(data)
    });
  } catch (error) {
    return handleProctorRouteError(error);
  }
}
