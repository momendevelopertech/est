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

function createLocaleCookieResponse(response: NextResponse, locale: string) {
  response.cookies.set({
    name: localeCookieName,
    value: locale,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}

async function persistLocalePreference(locale: string) {
  if (isLocale(locale)) {
    const session = await getSession();

    if (session) {
      await updateAppUserLocalePreference(session.user.id, locale);
    }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const redirectTo = sanitizeRedirectPath(url.searchParams.get("redirectTo"));
  const response = NextResponse.redirect(new URL(redirectTo, getRequestOrigin(request)), {
    status: 303
  });

  if (!isLocale(locale)) {
    return response;
  }

  await persistLocalePreference(locale);

  return createLocaleCookieResponse(response, locale);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        locale?: string;
      }
    | null;
  const locale = body?.locale ?? null;

  if (!isLocale(locale)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_locale"
      },
      {
        status: 400
      }
    );
  }

  await persistLocalePreference(locale);

  return createLocaleCookieResponse(
    NextResponse.json({
      ok: true,
      locale
    }),
    locale
  );
}
