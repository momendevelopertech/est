import { NextResponse } from "next/server";

import { toAssignmentDTO } from "@/lib/assignments/dto";
import { toWaitingListDTO } from "@/lib/waiting-list/dto";
import {
  handleWaitingListRouteError,
  readJsonBody,
  requireWaitingListApiRole
} from "@/lib/waiting-list/http";
import { promoteWaitingListEntry } from "@/lib/waiting-list/service";
import {
  promoteWaitingListEntrySchema,
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
    const input = promoteWaitingListEntrySchema.parse(body);
    const data = await promoteWaitingListEntry(
      routeParams.waitingListId,
      input,
      auth.session.user.id
    );

    return NextResponse.json({
      ok: true,
      data: {
        entry: toWaitingListDTO(data.entry),
        assignment: toAssignmentDTO(data.assignment)
      }
    });
  } catch (error) {
    return handleWaitingListRouteError(error);
  }
}

