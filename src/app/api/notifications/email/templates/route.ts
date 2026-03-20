import { NextResponse } from "next/server";

import {
  toNotificationEmailTemplateListDTO,
  toUpsertNotificationEmailTemplateDTO
} from "@/lib/notifications/email/dto";
import {
  getRequestQuery,
  handleNotificationEmailRouteError,
  readJsonBody,
  requireNotificationEmailTemplatesApiRole
} from "@/lib/notifications/email/http";
import {
  listNotificationEmailTemplates,
  upsertNotificationEmailTemplate
} from "@/lib/notifications/email/service";
import {
  notificationEmailTemplatesQuerySchema,
  upsertNotificationEmailTemplateSchema
} from "@/lib/notifications/email/validation";

export async function GET(request: Request) {
  const auth = await requireNotificationEmailTemplatesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = notificationEmailTemplatesQuerySchema.parse(
      getRequestQuery(request)
    );
    const result = await listNotificationEmailTemplates(query);

    return NextResponse.json({
      ok: true,
      data: toNotificationEmailTemplateListDTO(result)
    });
  } catch (error) {
    return handleNotificationEmailRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireNotificationEmailTemplatesApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = upsertNotificationEmailTemplateSchema.parse(body);
    const result = await upsertNotificationEmailTemplate({
      ...input,
      actorAppUserId: auth.session.user.id
    });

    return NextResponse.json(
      {
        ok: true,
        data: toUpsertNotificationEmailTemplateDTO(result)
      },
      {
        status: result.mode === "created" ? 201 : 200
      }
    );
  } catch (error) {
    return handleNotificationEmailRouteError(error);
  }
}
