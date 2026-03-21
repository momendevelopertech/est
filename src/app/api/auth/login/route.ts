import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

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

class AuthEnvironmentError extends Error {}

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

  try {
    if (env.NEXTAUTH_URL) {
      return env.NEXTAUTH_URL;
    }
  } catch {
    // Keep using request-derived origin when NEXTAUTH_URL is invalid.
  }

  return new URL(request.url).origin;
}

function validateAuthEnvironment() {
  void env.AUTH_SECRET;

  if (env.NODE_ENV === "production" && !env.NEXTAUTH_URL) {
    throw new AuthEnvironmentError("NEXTAUTH_URL is required in production");
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "");
  const redirectTo = sanitizeRedirectPath(String(formData.get("redirectTo") ?? ""));
  let requestOrigin = new URL(request.url).origin;

  try {
    validateAuthEnvironment();
    requestOrigin = getRequestOrigin(request);
    const appUser = await authenticateAppUser(email, password);

    if (!appUser) {
      const loginUrl = new URL("/login", requestOrigin);
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
    const response = NextResponse.redirect(new URL(redirectTo, requestOrigin), {
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
  } catch (error) {
    const mappedErrorCode =
      error instanceof AuthEnvironmentError || error instanceof ZodError
        ? ERROR_CODES.authEnvMisconfigured
        : error instanceof Prisma.PrismaClientInitializationError ||
            error instanceof Prisma.PrismaClientKnownRequestError ||
            error instanceof Prisma.PrismaClientUnknownRequestError ||
            error instanceof Prisma.PrismaClientRustPanicError
          ? ERROR_CODES.authDbUnavailable
          : ERROR_CODES.authServiceUnavailable;
    const rootCause =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message
          }
        : {
            message: String(error)
          };
    console.error("auth_login_request_failed", {
      code: mappedErrorCode,
      rootCause
    });

    const loginUrl = new URL("/login", requestOrigin);
    loginUrl.searchParams.set("error", mappedErrorCode);

    return NextResponse.redirect(loginUrl, {
      status: 303
    });
  }
}
