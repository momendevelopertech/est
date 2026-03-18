import { NextResponse } from "next/server";

import {
  deactivateUniversity,
  getUniversity,
  updateUniversity
} from "@/lib/locations/service";
import {
  getRequestQuery,
  handleLocationRouteError,
  readJsonBody,
  requireLocationsApiRole
} from "@/lib/locations/http";
import {
  locationDetailQuerySchema,
  updateUniversitySchema
} from "@/lib/locations/validation";

type UniversityRouteContext = {
  params: {
    universityId: string;
  };
};

export async function GET(_: Request, { params }: UniversityRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = locationDetailQuerySchema.parse(getRequestQuery(_));
    const data = await getUniversity(params.universityId, {
      includeInactive: query.includeInactive
    });

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: UniversityRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = updateUniversitySchema.parse(body);
    const data = await updateUniversity(
      params.universityId,
      input,
      auth.session.user.id
    );

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: UniversityRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await deactivateUniversity(
      params.universityId,
      auth.session.user.id
    );

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}
