import { NextResponse } from "next/server";

import {
  authCookieName,
  bootstrapUser,
  createSessionPayload
} from "@/lib/auth/config";
import {
  createSessionToken,
  getSessionCookieOptions
} from "@/lib/auth/session";
import { env } from "@/lib/env";
import { isLocale, localeCookieName } from "@/lib/i18n";

function sanitizeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "");
  const redirectTo = sanitizeRedirectPath(String(formData.get("redirectTo") ?? ""));

  if (
    email !== env.AUTH_BOOTSTRAP_EMAIL.toLowerCase() ||
    password !== env.AUTH_BOOTSTRAP_PASSWORD
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invalid_credentials");
    return NextResponse.redirect(loginUrl);
  }

  const session = {
    ...createSessionPayload(),
    user: bootstrapUser
  };
  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set({
    name: authCookieName,
    value: createSessionToken(session),
    ...getSessionCookieOptions(new Date(session.expiresAt))
  });

  if (isLocale(locale)) {
    response.cookies.set({
      name: localeCookieName,
      value: locale,
      path: "/",
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  return response;
}
