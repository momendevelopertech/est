import { NextResponse } from "next/server";

import { toInAppNotificationDTO } from "@/lib/notifications/in-app/dto";
import {
  handleInAppNotificationsRouteError,
  readJsonBody,
  requireInAppNotificationsApiSession
} from "@/lib/notifications/in-app/http";
import {
  InAppNotificationsServiceError,
  markAsRead,
  resolveNotificationUserIdForAppUser
} from "@/lib/notifications/in-app/service";
import { markInAppNotificationReadSchema } from "@/lib/notifications/in-app/validation";
import { ERROR_CODES } from "@/lib/errors/codes";

export async function POST(request: Request) {
  const auth = await requireInAppNotificationsApiSession();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = markInAppNotificationReadSchema.parse(body);
    const linkedUserId = await resolveNotificationUserIdForAppUser(auth.session.user.id);

    if (!linkedUserId) {
      throw new InAppNotificationsServiceError(
        ERROR_CODES.notificationNotFound,
        404,
        "In-app notification not found."
      );
    }

    const result = await markAsRead(input.notificationId, {
      userId: linkedUserId,
      actorAppUserId: auth.session.user.id
    });

    return NextResponse.json({
      ok: true,
      data: toInAppNotificationDTO(result.data)
    });
  } catch (error) {
    return handleInAppNotificationsRouteError(error);
  }
}
