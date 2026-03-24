import "server-only";

import { cookies } from "next/headers";

import { getSystemDefaultTheme } from "@/lib/settings/service";
import { isThemeMode, themeCookieName } from "@/lib/theme";

import type { ThemeMode } from "@/lib/auth/types";

export async function resolveRequestTheme(
  preferredTheme?: ThemeMode | null
): Promise<ThemeMode> {
  if (preferredTheme && isThemeMode(preferredTheme)) {
    return preferredTheme;
  }

  const cookieTheme = cookies().get(themeCookieName)?.value;

  if (isThemeMode(cookieTheme)) {
    return cookieTheme;
  }

  return getSystemDefaultTheme();
}

export function getThemeRootClass(theme: ThemeMode) {
  return theme;
}
