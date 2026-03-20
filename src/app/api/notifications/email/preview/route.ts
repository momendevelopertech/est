import { NextResponse } from "next/server";

import { toNotificationEmailPreviewDTO } from "@/lib/notifications/email/dto";
import {
  handleNotificationEmailRouteError,
  readJsonBody,
  requireNotificationEmailTemplatesApiRole
} from "@/lib/notifications/email/http";
import { previewNotificationEmailTemplate } from "@/lib/notifications/email/service";
import { notificationEmailPreviewSchema } from "@/lib/notifications/email/validation";

export async function POST(request: Request) {
  const auth = await requireNotificationEmailTemplatesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = notificationEmailPreviewSchema.parse(body);
    const result = await previewNotificationEmailTemplate({
      ...input,
      actorAppUserId: auth.session.user.id
    });

    return NextResponse.json({
      ok: true,
      data: toNotificationEmailPreviewDTO(result)
    });
  } catch (error) {
    return handleNotificationEmailRouteError(error);
  }
}
