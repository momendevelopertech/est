import { NextResponse } from "next/server";
import { z } from "zod";

import { toCycleDTO } from "@/lib/cycles/dto";
import {
  getRequestQuery,
  handleCycleRouteError,
  readJsonBody,
  requireCyclesApiRole
} from "@/lib/cycles/http";
import {
  deactivateCycle,
  getCycleById,
  permanentlyDeleteCycle,
  updateCycle
} from "@/lib/cycles/service";
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

const cycleDeleteQuerySchema = z.object({
  mode: z.enum(["deactivate", "hard"]).optional().default("deactivate")
});

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

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireCyclesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = cycleRouteParamsSchema.parse(params);
    const query = cycleDeleteQuerySchema.parse(getRequestQuery(request));
    const data =
      query.mode === "hard"
        ? await permanentlyDeleteCycle(routeParams.cycleId, auth.session.user.id)
        : await deactivateCycle(routeParams.cycleId, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: toCycleDTO(data)
    });
  } catch (error) {
    return handleCycleRouteError(error);
  }
}
