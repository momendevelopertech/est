import "server-only";

import { env } from "@/lib/env";

import type { AuthSession, SessionUser } from "./types";

export const authCookieName = "examops_session";

export const bootstrapUser: SessionUser = {
  email: env.AUTH_BOOTSTRAP_EMAIL.toLowerCase(),
  name: env.AUTH_BOOTSTRAP_NAME,
  role: env.AUTH_BOOTSTRAP_ROLE
};

export function getSessionExpiryDate() {
  return new Date(Date.now() + env.AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export function createSessionPayload(): AuthSession {
  return {
    user: bootstrapUser,
    expiresAt: getSessionExpiryDate().toISOString()
  };
}
