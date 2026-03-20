import { NextResponse } from "next/server";

import { toBlockDTO } from "@/lib/blocks/dto";
import {
  handleBlockRouteError,
  readJsonBody,
  requireBlocksApiRole
} from "@/lib/blocks/http";
import { unblockUser } from "@/lib/blocks/service";
import { unblockUserSchema } from "@/lib/blocks/validation";

export async function POST(request: Request) {
  const auth = await requireBlocksApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = unblockUserSchema.parse(body);
    const result = await unblockUser(input, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      data: toBlockDTO(result)
    });
  } catch (error) {
    return handleBlockRouteError(error);
  }
}
