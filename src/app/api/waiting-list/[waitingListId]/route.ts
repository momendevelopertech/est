import { NextResponse } from "next/server";

import { toWaitingListDTO } from "@/lib/waiting-list/dto";
import {
  handleWaitingListRouteError,
  requireWaitingListApiRole
} from "@/lib/waiting-list/http";
import { getWaitingListEntryById } from "@/lib/waiting-list/service";
import { waitingListRouteParamsSchema } from "@/lib/waiting-list/validation";

type RouteParams = {
  params: {
    waitingListId: string;
  };
};

export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireWaitingListApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = waitingListRouteParamsSchema.parse(params);
    const data = await getWaitingListEntryById(routeParams.waitingListId);

    return NextResponse.json({
      ok: true,
      data: toWaitingListDTO(data)
    });
  } catch (error) {
    return handleWaitingListRouteError(error);
  }
}

