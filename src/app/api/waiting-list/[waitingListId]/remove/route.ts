import { NextResponse } from "next/server";

import { toWaitingListDTO } from "@/lib/waiting-list/dto";
import {
  handleWaitingListRouteError,
  readJsonBody,
  requireWaitingListApiRole
} from "@/lib/waiting-list/http";
import { removeWaitingListEntry } from "@/lib/waiting-list/service";
import {
  removeWaitingListEntrySchema,
  waitingListRouteParamsSchema
} from "@/lib/waiting-list/validation";

type RouteParams = {
  params: {
    waitingListId: string;
  };
};

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireWaitingListApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = waitingListRouteParamsSchema.parse(params);
    const body = await readJsonBody(request);
    const input = removeWaitingListEntrySchema.parse(body);
    const data = await removeWaitingListEntry(
      routeParams.waitingListId,
      input,
      auth.session.user.id
    );

    return NextResponse.json({
      ok: true,
      data: toWaitingListDTO(data)
    });
  } catch (error) {
    return handleWaitingListRouteError(error);
  }
}

