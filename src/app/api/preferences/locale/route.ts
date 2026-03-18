import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { updateAppUserLocalePreference } from "@/lib/auth/service";
import { env } from "@/lib/env";
import { isLocale, localeCookieName } from "@/lib/i18n";

function sanitizeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const redirectTo = sanitizeRedirectPath(url.searchParams.get("redirectTo"));
  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  if (isLocale(locale)) {
    const session = await getSession();

    if (session) {
      await updateAppUserLocalePreference(session.user.id, locale);
    }

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
