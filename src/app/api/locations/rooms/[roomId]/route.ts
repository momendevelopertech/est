import { NextResponse } from "next/server";

import {
  deactivateRoom,
  getRoom,
  updateRoom
} from "@/lib/locations/service";
import {
  handleLocationRouteError,
  readJsonBody,
  requireLocationsApiRole
} from "@/lib/locations/http";
import { updateRoomSchema } from "@/lib/locations/validation";

type RoomRouteContext = {
  params: {
    roomId: string;
  };
};

export async function GET(_: Request, { params }: RoomRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await getRoom(params.roomId);

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: RoomRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = updateRoomSchema.parse(body);
    const data = await updateRoom(
      params.roomId,
      input,
      auth.session.user.id
    );

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}

export async function DELETE(_: Request, { params }: RoomRouteContext) {
  const auth = await requireLocationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await deactivateRoom(
      params.roomId,
      auth.session.user.id
    );

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return handleLocationRouteError(error);
  }
}
