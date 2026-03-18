import "server-only";

import { z } from "zod";

const appRoles = [
  "super_admin",
  "coordinator",
  "data_entry",
  "senior",
  "viewer"
] as const;

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_BOOTSTRAP_EMAIL: z.string().email("AUTH_BOOTSTRAP_EMAIL must be a valid email"),
  AUTH_BOOTSTRAP_PASSWORD: z.string().min(8, "AUTH_BOOTSTRAP_PASSWORD must be at least 8 characters"),
  AUTH_BOOTSTRAP_NAME: z.string().min(1, "AUTH_BOOTSTRAP_NAME is required"),
  AUTH_BOOTSTRAP_ROLE: z.enum(appRoles),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12)
});

export const env = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_BOOTSTRAP_EMAIL: process.env.AUTH_BOOTSTRAP_EMAIL,
  AUTH_BOOTSTRAP_PASSWORD: process.env.AUTH_BOOTSTRAP_PASSWORD,
  AUTH_BOOTSTRAP_NAME: process.env.AUTH_BOOTSTRAP_NAME,
  AUTH_BOOTSTRAP_ROLE: process.env.AUTH_BOOTSTRAP_ROLE,
  AUTH_SESSION_TTL_HOURS: process.env.AUTH_SESSION_TTL_HOURS
});
