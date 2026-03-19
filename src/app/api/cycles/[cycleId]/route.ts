import { NextResponse } from "next/server";

import { toCycleDTO } from "@/lib/cycles/dto";
import {
  getRequestQuery,
  handleCycleRouteError,
  readJsonBody,
  requireCyclesApiRole
} from "@/lib/cycles/http";
import { deleteCycle, getCycleById, updateCycle } from "@/lib/cycles/service";
import {
  cycleDetailQuerySchema,
  cycleRouteParamsSchema,
  updateCycleSchema
} from "@/lib/cycles/validation";

type RouteParams = {
  params: {
    cycleId: string;
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requireCyclesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = cycleRouteParamsSchema.parse(params);
    const query = cycleDetailQuerySchema.parse(getRequestQuery(request));
    const data = await getCycleById(routeParams.cycleId, {
      includeInactive: query.includeInactive
    });

    return NextResponse.json({
      ok: true,
      data: toCycleDTO(data)
    });
  } catch (error) {
    return handleCycleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireCyclesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = cycleRouteParamsSchema.parse(params);
    const body = await readJsonBody(request);
    const input = updateCycleSchema.parse(body);
    const data = await updateCycle(routeParams.cycleId, input, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: toCycleDTO(data)
    });
  } catch (error) {
    return handleCycleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireCyclesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = cycleRouteParamsSchema.parse(params);
    const data = await deleteCycle(routeParams.cycleId, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: toCycleDTO(data)
    });
  } catch (error) {
    return handleCycleRouteError(error);
  }
}
