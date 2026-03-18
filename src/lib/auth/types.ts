export const appRoles = [
  "super_admin",
  "coordinator",
  "data_entry",
  "senior",
  "viewer"
] as const;

export type AppRole = (typeof appRoles)[number];

export type SessionUser = {
  email: string;
  name: string;
  role: AppRole;
};

export type AuthSession = {
  user: SessionUser;
  expiresAt: string;
};
