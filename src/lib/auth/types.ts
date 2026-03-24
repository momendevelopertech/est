export const appRoles = [
  "super_admin",
  "coordinator",
  "data_entry",
  "senior",
  "viewer"
] as const;

export type AppRole = (typeof appRoles)[number];
export type LocalePreference = "ar" | "en";
export type ThemeMode = "light" | "dark";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string;
  role: AppRole;
  preferredLanguage: LocalePreference | null;
  preferredTheme: ThemeMode;
};

export type AuthSession = {
  sessionId: string;
  user: SessionUser;
  expiresAt: string;
};
