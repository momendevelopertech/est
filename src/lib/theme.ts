import type { ThemeMode } from "@/lib/auth/types";

export const themeCookieName = "examops_theme";
export const themeModes = ["light", "dark", "system"] as const;

export function isThemeMode(
  value: string | null | undefined
): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}
