import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSession } from "@/lib/auth/session";
import { ERROR_CODES } from "@/lib/errors/codes";
import { reportApiError } from "@/lib/monitoring/service";

import { NotificationPreferencesServiceError } from "./service";

type AuthorizedSession = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
};

type UnauthorizedSession = {
  response: NextResponse;
};

export type NotificationPreferencesApiSessionResult =
  | AuthorizedSession
  | UnauthorizedSession;

export async function requireNotificationPreferencesApiSession(): Promise<NotificationPreferencesApiSessionResult> {
  const session = await getSession();

  if (!session) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          error: ERROR_CODES.unauthorized
        },
        {
          status: 401
        }
      )
    };
  }

  return {
    session
  };
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new NotificationPreferencesServiceError(
      ERROR_CODES.invalidJson,
      400,
      "Request body must be valid JSON."
    );
  }
}

export function handleNotificationPreferencesRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: ERROR_CODES.validationError,
        details: error.flatten()
      },
      {
        status: 400
      }
    );
  }

  if (error instanceof NotificationPreferencesServiceError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.code,
        message: error.message,
        details: error.details ?? null
      },
      {
        status: error.status
      }
    );
  }

  void reportApiError({
    scope: "notifications_preferences",
    error
  });

  return NextResponse.json(
    {
      ok: false,
      error: ERROR_CODES.internalServerError
    },
    {
      status: 500
    }
  );
}
