import { NextResponse } from "next/server";

import { cloneCycle } from "@/lib/cycles/clone";
import { toCycleDTO } from "@/lib/cycles/dto";
import {
  handleCycleRouteError,
  readJsonBody,
  requireCyclesApiRole
} from "@/lib/cycles/http";
import {
  cloneCycleSchema,
  cycleRouteParamsSchema
} from "@/lib/cycles/validation";

type RouteParams = {
  params: {
    cycleId: string;
  };
};

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireCyclesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = cycleRouteParamsSchema.parse(params);
    const body = await readJsonBody(request);
    const input = cloneCycleSchema.parse(body);
    const result = await cloneCycle(
      {
        sourceCycleId: routeParams.cycleId,
        newStartDate: input.newStartDate,
        newEndDate: input.newEndDate,
        allowInactiveSource: input.allowInactiveSource
      },
      auth.session.user.id
    );

    return NextResponse.json(
      {
        ok: true,
        data: toCycleDTO(result.cycle),
        summary: result.summary
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleCycleRouteError(error);
  }
}
