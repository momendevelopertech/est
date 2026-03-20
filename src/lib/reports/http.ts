import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiRole } from "@/lib/auth/api";
import { ERROR_CODES } from "@/lib/errors/codes";
import { reportApiError } from "@/lib/monitoring/service";
import { MetricsServiceError } from "@/lib/metrics/service";

import { ReportsServiceError } from "./service";

export const reportsAccessRoles = [
  "super_admin",
  "coordinator",
  "data_entry",
  "senior",
  "viewer"
] as const;

export async function requireReportsApiRole() {
  return requireApiRole([...reportsAccessRoles]);
}

export function getRequestQuery(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export function handleReportsRouteError(error: unknown) {
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

  if (error instanceof ReportsServiceError || error instanceof MetricsServiceError) {
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
    scope: "reports",
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
