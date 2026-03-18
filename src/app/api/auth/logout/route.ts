import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authCookieName } from "@/lib/auth/config";
import { deletePersistedSession } from "@/lib/auth/service";
import { getSessionCookieOptions } from "@/lib/auth/session";

function getRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin;
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const token = cookies().get(authCookieName)?.value;

  if (token) {
    await deletePersistedSession(token);
  }

  const response = NextResponse.redirect(new URL("/login", getRequestOrigin(request)), {
    status: 303
  });
  response.cookies.set({
    name: authCookieName,
    value: "",
    ...getSessionCookieOptions(new Date(0))
  });

  return response;
}
