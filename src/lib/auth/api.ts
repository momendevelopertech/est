import { NextResponse } from "next/server";

import { ERROR_CODES } from "@/lib/errors/codes";

import type { AppRole, AuthSession } from "./types";
import { getSession } from "./session";

type AuthorizedApiSession = {
  session: AuthSession;
};

type UnauthorizedApiSession = {
  response: NextResponse;
};

export type ApiSessionResult = AuthorizedApiSession | UnauthorizedApiSession;

export async function requireApiRole(allowedRoles: AppRole[]): Promise<ApiSessionResult> {
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

  if (!allowedRoles.includes(session.user.role)) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          error: ERROR_CODES.forbidden
        },
        {
          status: 403
        }
      )
    };
  }

  return {
    session
  };
}
