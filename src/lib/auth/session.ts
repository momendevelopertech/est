import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";

import { authCookieName } from "./config";
import { getAuthSessionByToken } from "./service";

export function getSessionToken() {
  return cookies().get(authCookieName)?.value ?? null;
}

export async function getSession() {
  const token = getSessionToken();

  if (!token) {
    return null;
  }

  return getAuthSessionByToken(token);
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  };
}
