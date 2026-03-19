import { NextResponse } from "next/server";

import { ERROR_CODES } from "@/lib/errors/codes";
import { getSession } from "@/lib/auth/session";
import { updateAppUserThemePreference } from "@/lib/auth/service";
import { env } from "@/lib/env";
import { isThemeMode, themeCookieName } from "@/lib/theme";

function createThemeCookieResponse(response: NextResponse, theme: string) {
  response.cookies.set({
    name: themeCookieName,
    value: theme,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        theme?: string;
      }
    | null;
  const theme = body?.theme ?? null;

  if (!isThemeMode(theme)) {
    return NextResponse.json(
      {
        ok: false,
        error: ERROR_CODES.invalidTheme
      },
      {
        status: 400
      }
    );
  }

  const session = await getSession();

  if (session) {
    await updateAppUserThemePreference(session.user.id, theme);
  }

  return createThemeCookieResponse(
    NextResponse.json({
      ok: true,
      theme
    }),
    theme
  );
}
