import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiRole } from "@/lib/auth/api";
import { ERROR_CODES } from "@/lib/errors/codes";

import { PromotionServiceError } from "./service";

export const promotionManagementRoles = [
  "super_admin",
  "coordinator",
  "senior"
] as const;

export async function requirePromotionApiRole() {
  return requireApiRole([...promotionManagementRoles]);
}

export function getRequestQuery(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export function handlePromotionRouteError(error: unknown) {
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

  if (error instanceof PromotionServiceError) {
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

  console.error(error);

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
