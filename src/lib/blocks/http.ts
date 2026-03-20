import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiRole } from "@/lib/auth/api";
import { ERROR_CODES } from "@/lib/errors/codes";

import { BlockServiceError } from "./service";

export const blockManagementRoles = [
  "super_admin",
  "coordinator",
  "senior"
] as const;

export async function requireBlocksApiRole() {
  return requireApiRole([...blockManagementRoles]);
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new BlockServiceError(
      ERROR_CODES.invalidJson,
      400,
      "Request body must be valid JSON."
    );
  }
}

export function handleBlockRouteError(error: unknown) {
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

  if (error instanceof BlockServiceError) {
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
