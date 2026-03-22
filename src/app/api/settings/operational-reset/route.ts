import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/api";
import { ERROR_CODES } from "@/lib/errors/codes";
import { reportApiError } from "@/lib/monitoring/service";
import {
  getOperationalResetPreview,
  OperationalResetServiceError,
  resetOperationalData
} from "@/lib/settings/operational-reset";

export async function GET() {
  const auth = await requireApiRole(["super_admin"]);

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const preview = await getOperationalResetPreview();

    return NextResponse.json({
      ok: true,
      preview
    });
  } catch (error) {
    if (error instanceof OperationalResetServiceError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message
        },
        {
          status: error.status
        }
      );
    }

    await reportApiError({
      scope: "settings-operational-reset",
      actorAppUserId: auth.session.user.id,
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
}

export async function POST() {
  const auth = await requireApiRole(["super_admin"]);

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const result = await resetOperationalData();

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationalResetServiceError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message
        },
        {
          status: error.status
        }
      );
    }

    await reportApiError({
      scope: "settings-operational-reset",
      actorAppUserId: auth.session.user.id,
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
}
