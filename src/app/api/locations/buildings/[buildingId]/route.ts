import { NextResponse } from "next/server";

import {
  deactivateBuilding,
  getBuilding,
  updateBuilding
} from "@/lib/locations/service";
import {
  handleLocationRouteError,
  readJsonBody,
  requireLocationsApiRole
} from "@/lib/locations/http";
import { updateBuildingSchema } from "@/lib/locations/validation";

type BuildingRouteContext = {
  params: {
    buildingId: string;
  };
};

export async function GET(_: Request, { params }: BuildingRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await getBuilding(params.buildingId);

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: BuildingRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = updateBuildingSchema.parse(body);
    const data = await updateBuilding(
      params.buildingId,
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

export async function DELETE(_: Request, { params }: BuildingRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await deactivateBuilding(
      params.buildingId,
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
