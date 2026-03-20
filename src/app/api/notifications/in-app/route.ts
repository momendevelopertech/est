import { NextResponse } from "next/server";

import { toInAppNotificationListDTO } from "@/lib/notifications/in-app/dto";
import {
  getRequestQuery,
  handleInAppNotificationsRouteError,
  requireInAppNotificationsApiSession
} from "@/lib/notifications/in-app/http";
import {
  listUserNotifications,
  resolveNotificationUserIdForAppUser
} from "@/lib/notifications/in-app/service";
import { inAppNotificationsQuerySchema } from "@/lib/notifications/in-app/validation";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";

export async function GET(request: Request) {
  const auth = await requireInAppNotificationsApiSession();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = inAppNotificationsQuerySchema.parse(getRequestQuery(request));
    const linkedUserId = await resolveNotificationUserIdForAppUser(auth.session.user.id);
    const result = linkedUserId
      ? await listUserNotifications(linkedUserId, query)
      : {
          data: [],
          total: 0,
          unreadCount: 0,
          pagination: buildPaginationMeta(0, resolvePagination(query))
        };

    return NextResponse.json({
      ok: true,
      data: toInAppNotificationListDTO(result)
    });
  } catch (error) {
    return handleInAppNotificationsRouteError(error);
  }
}
