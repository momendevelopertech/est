import { NextResponse } from "next/server";

import { toSmsTestMessageResultDTO } from "@/lib/notifications/sms/dto";
import {
  handleSmsRouteError,
  readJsonBody,
  requireSmsApiRole
} from "@/lib/notifications/sms/http";
import { sendSmsTestMessage } from "@/lib/notifications/sms/service";

export async function POST(request: Request) {
  const auth = await requireSmsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const result = await sendSmsTestMessage(body, {
      actorAppUserId: auth.session.user.id
    });

    return NextResponse.json({
      ok: true,
      data: toSmsTestMessageResultDTO(result)
    });
  } catch (error) {
    return handleSmsRouteError(error);
  }
}
