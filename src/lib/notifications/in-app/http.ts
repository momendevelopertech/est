import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSession } from "@/lib/auth/session";
import { ERROR_CODES } from "@/lib/errors/codes";
import { reportApiError } from "@/lib/monitoring/service";

import { InAppNotificationsServiceError } from "./service";

type AuthorizedSession = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
};

type UnauthorizedSession = {
  response: NextResponse;
};

export type InAppNotificationsApiSessionResult =
  | AuthorizedSession
  | UnauthorizedSession;

export async function requireInAppNotificationsApiSession(): Promise<InAppNotificationsApiSessionResult> {
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

export function getRequestQuery(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new InAppNotificationsServiceError(
      ERROR_CODES.invalidJson,
      400,
      "Request body must be valid JSON."
    );
  }
}

export async function readOptionalJsonBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new InAppNotificationsServiceError(
      ERROR_CODES.invalidJson,
      400,
      "Request body must be valid JSON."
    );
  }
}

export function handleInAppNotificationsRouteError(error: unknown) {
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

  if (error instanceof InAppNotificationsServiceError) {
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
    scope: "notifications_in_app",
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
