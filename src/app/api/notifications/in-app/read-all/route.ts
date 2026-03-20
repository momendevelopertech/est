import { NextResponse } from "next/server";

import { toMarkAllInAppNotificationsReadDTO } from "@/lib/notifications/in-app/dto";
import {
  handleInAppNotificationsRouteError,
  readOptionalJsonBody,
  requireInAppNotificationsApiSession
} from "@/lib/notifications/in-app/http";
import {
  markAllAsRead,
  resolveNotificationUserIdForAppUser
} from "@/lib/notifications/in-app/service";
import { markAllInAppNotificationsReadSchema } from "@/lib/notifications/in-app/validation";

export async function POST(request: Request) {
  const auth = await requireInAppNotificationsApiSession();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readOptionalJsonBody(request);
    markAllInAppNotificationsReadSchema.parse(body);
    const linkedUserId = await resolveNotificationUserIdForAppUser(auth.session.user.id);

    const result = linkedUserId
      ? await markAllAsRead(linkedUserId, {
          actorAppUserId: auth.session.user.id
        })
      : {
          updatedCount: 0,
          readAt: new Date()
        };

    return NextResponse.json({
      ok: true,
      data: toMarkAllInAppNotificationsReadDTO(result)
    });
  } catch (error) {
    return handleInAppNotificationsRouteError(error);
  }
}
