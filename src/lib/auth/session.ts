import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";

import { authCookieName } from "./config";
import type { AuthSession } from "./types";

function sign(value: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url");
}

export function createSessionToken(session: AuthSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

function decodeSession(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as AuthSession;

    if (new Date(session.expiresAt) <= new Date()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getSession() {
  const token = cookies().get(authCookieName)?.value;

  if (!token) {
    return null;
  }

  return decodeSession(token);
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
