import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiRole } from "@/lib/auth/api";

import { ProctorsServiceError } from "./service";

export const proctorManagementRoles = [
  "super_admin",
  "coordinator",
  "data_entry"
] as const;

export async function requireProctorsApiRole() {
  return requireApiRole([...proctorManagementRoles]);
}

export function getRequestQuery(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ProctorsServiceError("invalid_json", 400, "Request body must be valid JSON.");
  }
}

export function handleProctorRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_error",
        details: error.flatten()
      },
      {
        status: 400
      }
    );
  }

  if (error instanceof ProctorsServiceError) {
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
      error: "internal_server_error"
    },
    {
      status: 500
    }
  );
}
