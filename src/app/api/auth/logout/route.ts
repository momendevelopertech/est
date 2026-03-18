import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authCookieName } from "@/lib/auth/config";
import { deletePersistedSession } from "@/lib/auth/service";
import { getSessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const token = cookies().get(authCookieName)?.value;

  if (token) {
    await deletePersistedSession(token);
  }

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303
  });
  response.cookies.set({
    name: authCookieName,
    value: "",
    ...getSessionCookieOptions(new Date(0))
  });

  return response;
}
