import { NextResponse } from "next/server";

import { toWhatsAppTestMessageResultDTO } from "@/lib/notifications/whatsapp/dto";
import {
  handleWhatsAppRouteError,
  readJsonBody,
  requireWhatsAppApiRole
} from "@/lib/notifications/whatsapp/http";
import { sendWhatsAppTestMessage } from "@/lib/notifications/whatsapp/service";

export async function POST(request: Request) {
  const auth = await requireWhatsAppApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const result = await sendWhatsAppTestMessage(body, {
      actorAppUserId: auth.session.user.id
    });

    return NextResponse.json({
      ok: true,
      data: toWhatsAppTestMessageResultDTO(result)
    });
  } catch (error) {
    return handleWhatsAppRouteError(error);
  }
}
