import { NextResponse } from "next/server";

import { authCookieName } from "@/lib/auth/config";
import { getSessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set({
    name: authCookieName,
    value: "",
    ...getSessionCookieOptions(new Date(0))
  });

  return response;
}
