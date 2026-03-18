import { NextResponse } from "next/server";

import {
  createRoom,
  listRooms
} from "@/lib/locations/service";
import {
  getRequestQuery,
  handleLocationRouteError,
  readJsonBody,
  requireLocationsApiRole
} from "@/lib/locations/http";
import {
  createRoomSchema,
  roomListQuerySchema
} from "@/lib/locations/validation";

export async function GET(request: Request) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = roomListQuerySchema.parse(getRequestQuery(request));
    const data = await listRooms(query);

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createRoomSchema.parse(body);
    const data = await createRoom(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        data
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleLocationRouteError(error);
  }
}
