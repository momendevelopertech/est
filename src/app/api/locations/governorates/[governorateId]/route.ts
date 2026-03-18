import { NextResponse } from "next/server";

import {
  deactivateGovernorate,
  getGovernorate,
  updateGovernorate
} from "@/lib/locations/service";
import {
  handleLocationRouteError,
  readJsonBody,
  requireLocationsApiRole
} from "@/lib/locations/http";
import { updateGovernorateSchema } from "@/lib/locations/validation";

type GovernorateRouteContext = {
  params: {
    governorateId: string;
  };
};

export async function GET(_: Request, { params }: GovernorateRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await getGovernorate(params.governorateId);

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: GovernorateRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = updateGovernorateSchema.parse(body);
    const data = await updateGovernorate(
      params.governorateId,
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

export async function DELETE(_: Request, { params }: GovernorateRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await deactivateGovernorate(
      params.governorateId,
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
