import { NextResponse } from "next/server";

import { authCookieName } from "@/lib/auth/config";
import { ERROR_CODES } from "@/lib/errors/codes";
import {
  authenticateAppUser,
  createPersistedSession
} from "@/lib/auth/service";
import {
  getSessionCookieOptions
} from "@/lib/auth/session";
import { env } from "@/lib/env";
import { isLocale, localeCookieName } from "@/lib/i18n";
import { themeCookieName } from "@/lib/theme";

function sanitizeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

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
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "");
  const redirectTo = sanitizeRedirectPath(String(formData.get("redirectTo") ?? ""));

  const appUser = await authenticateAppUser(email, password);

  if (!appUser) {
    const loginUrl = new URL("/login", getRequestOrigin(request));
    loginUrl.searchParams.set("error", ERROR_CODES.invalidCredentials);

    return NextResponse.redirect(loginUrl, {
      status: 303
    });
  }

  const session = await createPersistedSession({
    appUserId: appUser.id,
    locale: isLocale(locale) ? locale : null,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: request.headers.get("user-agent")
  });
  const response = NextResponse.redirect(new URL(redirectTo, getRequestOrigin(request)), {
    status: 303
  });

  response.cookies.set({
    name: authCookieName,
    value: session.token,
    ...getSessionCookieOptions(new Date(session.session.expiresAt))
  });

  const resolvedLocale = isLocale(locale)
    ? locale
    : session.session.user.preferredLanguage;

  if (resolvedLocale) {
    response.cookies.set({
      name: localeCookieName,
      value: resolvedLocale,
      path: "/",
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  response.cookies.set({
    name: themeCookieName,
    value: session.session.user.preferredTheme,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}
