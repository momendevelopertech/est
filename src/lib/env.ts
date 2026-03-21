import "server-only";

import { z } from "zod";

const nodeEnvSchema = z
  .enum(["development", "test", "production"])
  .default("development");

const authSessionTtlHoursSchema = z.coerce.number().int().positive().default(12);

const envKeyAliases = {
  DATABASE_URL: ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"],
  DIRECT_DATABASE_URL: [
    "DIRECT_DATABASE_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_URL"
  ],
  AUTH_SECRET: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
  NEXTAUTH_URL: ["NEXTAUTH_URL"]
} as const;

type ServerEnv = {
  NODE_ENV: z.infer<typeof nodeEnvSchema>;
  DATABASE_URL: string;
  DIRECT_DATABASE_URL: string | undefined;
  AUTH_SECRET: string;
  NEXTAUTH_URL: string | undefined;
  AUTH_SESSION_TTL_HOURS: number;
};

const cachedEnvValues: Partial<ServerEnv> = {};

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function readRequiredStringEnv(key: "DATABASE_URL" | "AUTH_SECRET") {
  const schema =
    key === "AUTH_SECRET"
      ? z.string().min(32, "AUTH_SECRET must be at least 32 characters")
      : z.string().min(1, `${key} is required`);

  return schema.parse(resolveEnvValue(key));
}

function readOptionalStringEnv(key: "DIRECT_DATABASE_URL") {
  return z.string().min(1).optional().parse(resolveEnvValue(key));
}

function readOptionalUrlEnv(key: "NEXTAUTH_URL") {
  return z.string().url(`${key} must be a valid absolute URL`).optional().parse(
    resolveEnvValue(key)
  );
}

function resolveEnvValue(key: keyof typeof envKeyAliases) {
  for (const envKey of envKeyAliases[key]) {
    const value = normalizeEnvValue(process.env[envKey]);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function getCachedEnvValue<K extends keyof ServerEnv>(
  key: K,
  resolver: () => ServerEnv[K]
) {
  const cached = cachedEnvValues[key];

  if (cached !== undefined) {
    return cached as ServerEnv[K];
  }

  const resolved = resolver();
  cachedEnvValues[key] = resolved;
  return resolved;
}

export const env: ServerEnv = {
  get NODE_ENV() {
    return getCachedEnvValue("NODE_ENV", () =>
      nodeEnvSchema.parse(normalizeEnvValue(process.env.NODE_ENV))
    );
  },
  get DATABASE_URL() {
    return getCachedEnvValue("DATABASE_URL", () =>
      readRequiredStringEnv("DATABASE_URL")
    );
  },
  get DIRECT_DATABASE_URL() {
    return getCachedEnvValue("DIRECT_DATABASE_URL", () =>
      readOptionalStringEnv("DIRECT_DATABASE_URL")
    );
  },
  get AUTH_SECRET() {
    return getCachedEnvValue("AUTH_SECRET", () =>
      readRequiredStringEnv("AUTH_SECRET")
    );
  },
  get NEXTAUTH_URL() {
    return getCachedEnvValue("NEXTAUTH_URL", () =>
      readOptionalUrlEnv("NEXTAUTH_URL")
    );
  },
  get AUTH_SESSION_TTL_HOURS() {
    return getCachedEnvValue("AUTH_SESSION_TTL_HOURS", () =>
      authSessionTtlHoursSchema.parse(
        normalizeEnvValue(process.env.AUTH_SESSION_TTL_HOURS)
      )
    );
  }
};
