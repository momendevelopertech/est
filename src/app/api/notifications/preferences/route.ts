import { NextResponse } from "next/server";

import { toNotificationPreferenceDTO } from "@/lib/notifications/preferences/dto";
import {
  handleNotificationPreferencesRouteError,
  readJsonBody,
  requireNotificationPreferencesApiSession
} from "@/lib/notifications/preferences/http";
import {
  NotificationPreferencesServiceError,
  getUserPreferences,
  updateUserPreferences
} from "@/lib/notifications/preferences/service";
import { updateNotificationPreferencesSchema } from "@/lib/notifications/preferences/validation";
import { resolveNotificationUserIdForAppUser } from "@/lib/notifications/in-app/service";
import { ERROR_CODES } from "@/lib/errors/codes";

export async function GET() {
  const auth = await requireNotificationPreferencesApiSession();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const linkedUserId = await resolveNotificationUserIdForAppUser(auth.session.user.id);

    if (!linkedUserId) {
      throw new NotificationPreferencesServiceError(
        ERROR_CODES.userNotFound,
        404,
        "Linked user not found for notification preferences."
      );
    }

    const result = await getUserPreferences(linkedUserId);

    return NextResponse.json({
      ok: true,
      data: toNotificationPreferenceDTO(result)
    });
  } catch (error) {
    return handleNotificationPreferencesRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireNotificationPreferencesApiSession();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const linkedUserId = await resolveNotificationUserIdForAppUser(auth.session.user.id);

    if (!linkedUserId) {
      throw new NotificationPreferencesServiceError(
        ERROR_CODES.userNotFound,
        404,
        "Linked user not found for notification preferences."
      );
    }

    const body = await readJsonBody(request);
    const input = updateNotificationPreferencesSchema.parse(body);
    const result = await updateUserPreferences(linkedUserId, input, {
      actorAppUserId: auth.session.user.id
    });

    return NextResponse.json({
      ok: true,
      data: toNotificationPreferenceDTO(result)
    });
  } catch (error) {
    return handleNotificationPreferencesRouteError(error);
  }
}
