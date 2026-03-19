import { NextResponse } from "next/server";

import {
  handleSwapRouteError,
  readJsonBody,
  requireSwapsApiRole
} from "@/lib/swaps/http";
import { executeSwap } from "@/lib/swaps/service";
import { executeSwapSchema } from "@/lib/swaps/validation";

export async function POST(request: Request) {
  const auth = await requireSwapsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = executeSwapSchema.parse(body);
    const result = await executeSwap(input, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: result
    });
  } catch (error) {
    return handleSwapRouteError(error);
  }
}
