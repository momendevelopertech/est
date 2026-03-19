import { NextResponse } from "next/server";

import { toCycleDTO } from "@/lib/cycles/dto";
import {
  getRequestQuery,
  handleCycleRouteError,
  readJsonBody,
  requireCyclesApiRole
} from "@/lib/cycles/http";
import { createCycle, listCycles } from "@/lib/cycles/service";
import { createCycleSchema, cycleListQuerySchema } from "@/lib/cycles/validation";

export async function GET(request: Request) {
  const auth = await requireCyclesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = cycleListQuerySchema.parse(getRequestQuery(request));
    const result = await listCycles(query);

    return NextResponse.json({
      ok: true,
      data: result.data.map((cycle) => toCycleDTO(cycle)),
      pagination: result.pagination
    });
  } catch (error) {
    return handleCycleRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireCyclesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createCycleSchema.parse(body);
    const data = await createCycle(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        data: toCycleDTO(data)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleCycleRouteError(error);
  }
}
