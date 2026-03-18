import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { LocaleCode, type Prisma } from "@prisma/client";
import { compare } from "bcryptjs";

import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n";

import {
  getSessionExpiryDate,
  toAppRole,
  toLocalePreference,
  toThemeMode,
  toThemePreference
} from "./config";
import type { AuthSession, SessionUser, ThemeMode } from "./types";

const sessionUserSelect = {
  id: true,
  displayName: true,
  email: true,
  role: true,
  preferredLanguage: true,
  preferredTheme: true,
  isActive: true
} satisfies Prisma.AppUserSelect;

const authUserSelect = {
  ...sessionUserSelect,
  passwordHash: true
} satisfies Prisma.AppUserSelect;

type SessionUserRecord = Prisma.AppUserGetPayload<{
  select: typeof sessionUserSelect;
}>;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function buildSessionUser(appUser: SessionUserRecord): SessionUser {
  return {
    id: appUser.id,
    email: appUser.email,
    name: appUser.displayName,
    role: toAppRole(appUser.role),
    preferredLanguage: toLocalePreference(appUser.preferredLanguage),
    preferredTheme: toThemeMode(appUser.preferredTheme)
  };
}

function isSessionExpired(expiresAt: Date) {
  return expiresAt <= new Date();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function toLocaleCode(locale: Locale): LocaleCode {
  return locale === "ar" ? LocaleCode.AR : LocaleCode.EN;
}

export async function authenticateAppUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return null;
  }

  const appUser = await db.appUser.findFirst({
    where: {
      email: normalizedEmail,
      isActive: true
    },
    select: authUserSelect
  });

  if (!appUser?.passwordHash) {
    return null;
  }

  const passwordMatches = await compare(password, appUser.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return appUser;
}

export async function createPersistedSession(params: {
  appUserId: string;
  locale?: Locale | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = getSessionExpiryDate();
  const lastSeenAt = new Date();
  const preferredLanguage = params.locale ? toLocaleCode(params.locale) : undefined;

  const [sessionRecord, appUser] = await db.$transaction(async (tx) => {
    const session = await tx.appSession.create({
      data: {
        appUserId: params.appUserId,
        tokenHash,
        expiresAt,
        lastSeenAt,
        ipAddress: params.ipAddress ?? undefined,
        userAgent: params.userAgent ?? undefined
      }
    });

    const user = await tx.appUser.update({
      where: {
        id: params.appUserId
      },
      data: {
        lastLoginAt: lastSeenAt,
        ...(preferredLanguage
          ? {
              preferredLanguage
            }
          : {})
      },
      select: sessionUserSelect
    });

    return [session, user] as const;
  });

  return {
    token,
    session: {
      sessionId: sessionRecord.id,
      user: buildSessionUser(appUser),
      expiresAt: sessionRecord.expiresAt.toISOString()
    } satisfies AuthSession
  };
}

export async function getAuthSessionByToken(token: string) {
  const session = await db.appSession.findUnique({
    where: {
      tokenHash: hashSessionToken(token)
    },
    include: {
      appUser: {
        select: sessionUserSelect
      }
    }
  });

  if (!session) {
    return null;
  }

  if (isSessionExpired(session.expiresAt) || !session.appUser.isActive) {
    await db.appSession.deleteMany({
      where: {
        id: session.id
      }
    });

    return null;
  }

  const now = new Date();
  const minutesSinceLastSeen =
    (now.getTime() - session.lastSeenAt.getTime()) / (60 * 1000);

  if (minutesSinceLastSeen >= 15) {
    void db.appSession.update({
      where: {
        id: session.id
      },
      data: {
        lastSeenAt: now
      }
    });
  }

  return {
    sessionId: session.id,
    user: buildSessionUser(session.appUser),
    expiresAt: session.expiresAt.toISOString()
  } satisfies AuthSession;
}

export async function deletePersistedSession(token: string) {
  await db.appSession.deleteMany({
    where: {
      tokenHash: hashSessionToken(token)
    }
  });
}

export async function updateAppUserLocalePreference(
  appUserId: string,
  locale: Locale
) {
  await db.appUser.update({
    where: {
      id: appUserId
    },
    data: {
      preferredLanguage: toLocaleCode(locale)
    }
  });
}

export async function updateAppUserThemePreference(
  appUserId: string,
  theme: ThemeMode
) {
  await db.appUser.update({
    where: {
      id: appUserId
    },
    data: {
      preferredTheme: toThemePreference(theme)
    }
  });
}
