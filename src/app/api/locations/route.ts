import { NextResponse } from "next/server";

import { toLocationDTO } from "@/lib/locations/dto";
import {
  getRequestQuery,
  handleLocationRouteError,
  requireLocationsApiRole
} from "@/lib/locations/http";
import { getLocationsTree } from "@/lib/locations/service";
import { locationsTreeQuerySchema } from "@/lib/locations/validation";

export async function GET(request: Request) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = locationsTreeQuerySchema.parse(getRequestQuery(request));
    const data = await getLocationsTree(query.includeInactive);

    return NextResponse.json({
      ok: true,
      data: data.map((location) => toLocationDTO(location))
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}
