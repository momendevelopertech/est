import { NextResponse } from "next/server";

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
          error: "unauthorized"
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
          error: "forbidden"
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
