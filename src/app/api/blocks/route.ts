import { NextResponse } from "next/server";

import { toBlockDTO } from "@/lib/blocks/dto";
import {
  handleBlockRouteError,
  readJsonBody,
  requireBlocksApiRole
} from "@/lib/blocks/http";
import { createBlock } from "@/lib/blocks/service";
import { createBlockSchema } from "@/lib/blocks/validation";

export async function POST(request: Request) {
  const auth = await requireBlocksApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createBlockSchema.parse(body);
    const result = await createBlock(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        mode: result.mode,
        data: toBlockDTO(result)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleBlockRouteError(error);
  }
}
