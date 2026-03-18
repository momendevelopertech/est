import "server-only";

import { ThemePreference, type AppUserRole, type LocaleCode } from "@prisma/client";

import { env } from "@/lib/env";

import type {
  AppRole,
  LocalePreference,
  ThemeMode
} from "./types";

export const authCookieName = "examops_session";

const appRoleMap: Record<AppUserRole, AppRole> = {
  SUPER_ADMIN: "super_admin",
  COORDINATOR: "coordinator",
  DATA_ENTRY: "data_entry",
  SENIOR: "senior",
  VIEWER: "viewer"
};

const localeMap: Record<LocaleCode, LocalePreference> = {
  AR: "ar",
  EN: "en"
};

const themeMap: Record<ThemePreference, ThemeMode> = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system"
};

export function getSessionExpiryDate() {
  return new Date(Date.now() + env.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export function toAppRole(role: AppUserRole): AppRole {
  return appRoleMap[role];
}

export function toLocalePreference(
  locale: LocaleCode | null | undefined
): LocalePreference | null {
  if (!locale) {
    return null;
  }

  return localeMap[locale];
}

export function toThemeMode(theme: ThemePreference | null | undefined): ThemeMode {
  if (!theme) {
    return "system";
  }

  return themeMap[theme];
}

export function toThemePreference(theme: ThemeMode): ThemePreference {
  switch (theme) {
    case "light":
      return ThemePreference.LIGHT;
    case "dark":
      return ThemePreference.DARK;
    default:
      return ThemePreference.SYSTEM;
  }
}
