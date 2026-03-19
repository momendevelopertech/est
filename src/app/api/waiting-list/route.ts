import { NextResponse } from "next/server";

import { toWaitingListDTO } from "@/lib/waiting-list/dto";
import {
  getRequestQuery,
  handleWaitingListRouteError,
  readJsonBody,
  requireWaitingListApiRole
} from "@/lib/waiting-list/http";
import {
  createWaitingListEntry,
  getWaitingListEntries
} from "@/lib/waiting-list/service";
import {
  createWaitingListEntrySchema,
  waitingListListQuerySchema
} from "@/lib/waiting-list/validation";

export async function GET(request: Request) {
  const auth = await requireWaitingListApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = waitingListListQuerySchema.parse(getRequestQuery(request));
    const result = await getWaitingListEntries(query);

    return NextResponse.json({
      ok: true,
      data: result.data.map((entry) => toWaitingListDTO(entry)),
      pagination: result.pagination
    });
  } catch (error) {
    return handleWaitingListRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireWaitingListApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createWaitingListEntrySchema.parse(body);
    const data = await createWaitingListEntry(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        data: toWaitingListDTO(data)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleWaitingListRouteError(error);
  }
}

