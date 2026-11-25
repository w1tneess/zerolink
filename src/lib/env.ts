import { z } from "zod";
import crypto from "node:crypto";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_DRIVER: z
    .enum(["pglite", "neon"])
    .default("pglite"),
  DATABASE_URL: z.string().default(""),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  POW_SECRET: z.string().optional(),
  POW_DIFFICULTY: z.coerce.number().int().min(4).max(24).default(16),
  DEFAULT_REDIRECT_CODE: z.coerce
    .number()
    .pipe(z.union([z.literal(301), z.literal(302), z.literal(307)]))
    .default(302),
});

export type AppEnv = z.infer<typeof envSchema>;

let ephemeralDevSecret: string | null = null;

function getProcessFallbackSecret(): string {
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString("hex");
  }
  return ephemeralDevSecret;
}

export function getEnv(): AppEnv {
  // Vercel deployments default to Neon; local development uses embedded PGlite.
  const isVercel = process.env.VERCEL === "1";
  const driver = process.env.DATABASE_DRIVER || (isVercel ? "neon" : "pglite");
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_BASE_URL: process.env.APP_BASE_URL || "http://localhost:3000",
    DATABASE_DRIVER: driver,
    DATABASE_URL:
      process.env.DATABASE_URL ||
      (driver === "pglite" ? "./data/pgdata" : ""),
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || undefined,
    SESSION_SECRET: process.env.SESSION_SECRET || undefined,
    POW_SECRET: process.env.POW_SECRET || undefined,
    POW_DIFFICULTY: process.env.POW_DIFFICULTY || 16,
    DEFAULT_REDIRECT_CODE: process.env.DEFAULT_REDIRECT_CODE || 302,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  return parsed.data;
}

export function getSessionSecret(): string {
  const env = getEnv();
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 16) {
    return env.SESSION_SECRET;
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET (at least 16 characters) must be configured in production."
    );
  }
  return getProcessFallbackSecret();
}

export function getPowSecret(): string {
  const env = getEnv();
  if (env.POW_SECRET && env.POW_SECRET.length >= 16) {
    return env.POW_SECRET;
  }
  return getSessionSecret();
}
