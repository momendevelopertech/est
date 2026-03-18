import { NextResponse } from "next/server";

import {
  deactivateFloor,
  getFloor,
  updateFloor
} from "@/lib/locations/service";
import {
  handleLocationRouteError,
  readJsonBody,
  requireLocationsApiRole
} from "@/lib/locations/http";
import { updateFloorSchema } from "@/lib/locations/validation";

type FloorRouteContext = {
  params: {
    floorId: string;
  };
};

export async function GET(_: Request, { params }: FloorRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await getFloor(params.floorId);

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: FloorRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = updateFloorSchema.parse(body);
    const data = await updateFloor(
      params.floorId,
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

export async function DELETE(_: Request, { params }: FloorRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await deactivateFloor(
      params.floorId,
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
