import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

type HealthStatus = "ok" | "error";

export async function GET() {
  let hasNextAuthUrl = false;

  try {
    hasNextAuthUrl = Boolean(env.NEXTAUTH_URL);
  } catch (error) {
    console.error("health_check_env_validation_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  }

  const envChecks = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET),
    NEXTAUTH_URL: hasNextAuthUrl
  };

  const checks = {
    database: "error" as HealthStatus,
    usersTable: "error" as HealthStatus,
    appUsersTable: "error" as HealthStatus
  };

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";

    const tableRows = await db.$queryRaw<
      Array<{ users_table: string | null; app_users_table: string | null }>
    >`SELECT to_regclass('public.users')::text AS users_table, to_regclass('public.app_users')::text AS app_users_table`;
    const tableRow = tableRows[0];

    if (tableRow?.users_table) {
      checks.usersTable = "ok";
    }

    if (tableRow?.app_users_table) {
      checks.appUsersTable = "ok";
    }

    const status: HealthStatus =
      checks.database === "ok" &&
      checks.usersTable === "ok" &&
      checks.appUsersTable === "ok" &&
      envChecks.DATABASE_URL &&
      envChecks.NEXTAUTH_SECRET &&
      envChecks.NEXTAUTH_URL
        ? "ok"
        : "error";

    return NextResponse.json(
      {
        status,
        checks,
        env: envChecks
      },
      {
        status: status === "ok" ? 200 : 503
      }
    );
  } catch (error) {
    const rootCause =
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error instanceof ZodError
        ? {
            name: error.name,
            message: error.message
          }
        : {
            message: String(error)
          };

    console.error("health_check_failed", { rootCause });

    return NextResponse.json(
      {
        status: "error",
        checks,
        env: envChecks,
        error: "health_check_failed"
      },
      { status: 503 }
    );
  }
}
