import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiRole } from "@/lib/auth/api";
import { ERROR_CODES } from "@/lib/errors/codes";
import { reportApiError } from "@/lib/monitoring/service";

import { WaitingListServiceError } from "./service";

export const waitingListManagementRoles = [
  "super_admin",
  "coordinator",
  "data_entry",
  "senior"
] as const;

export async function requireWaitingListApiRole() {
  return requireApiRole([...waitingListManagementRoles]);
}

export function getRequestQuery(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new WaitingListServiceError(
      ERROR_CODES.invalidJson,
      400,
      "Request body must be valid JSON."
    );
  }
}

export function handleWaitingListRouteError(error: unknown) {
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

  if (error instanceof WaitingListServiceError) {
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
    scope: "waiting_list",
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

