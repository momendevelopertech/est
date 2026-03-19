import { NextResponse } from "next/server";

import { toLocationDTO } from "@/lib/locations/dto";
import {
  createBuilding,
  listBuildings
} from "@/lib/locations/service";
import {
  getRequestQuery,
  handleLocationRouteError,
  readJsonBody,
  requireLocationsApiRole
} from "@/lib/locations/http";
import {
  buildingListQuerySchema,
  createBuildingSchema
} from "@/lib/locations/validation";

export async function GET(request: Request) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = buildingListQuerySchema.parse(getRequestQuery(request));
    const result = await listBuildings(query);

    return NextResponse.json({
      ok: true,
      data: result.data.map((location) => toLocationDTO(location)),
      pagination: result.pagination
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createBuildingSchema.parse(body);
    const data = await createBuilding(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        data: toLocationDTO(data)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleLocationRouteError(error);
  }
}
