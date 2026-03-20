import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiRole } from "@/lib/auth/api";
import { ERROR_CODES } from "@/lib/errors/codes";
import { reportApiError } from "@/lib/monitoring/service";

import { NotificationTriggerServiceError } from "./service";

export const notificationTriggerManagementRoles = [
  "super_admin",
  "coordinator",
  "data_entry"
] as const;

export async function requireNotificationTriggerApiRole() {
  return requireApiRole([...notificationTriggerManagementRoles]);
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new NotificationTriggerServiceError(
      ERROR_CODES.invalidJson,
      400,
      "Request body must be valid JSON."
    );
  }
}

export function handleNotificationTriggerRouteError(error: unknown) {
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

  if (error instanceof NotificationTriggerServiceError) {
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
    scope: "notifications_triggers",
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
