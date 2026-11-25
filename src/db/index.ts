import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { getEnv, type AppEnv } from "@/lib/env";

/** Both supported drivers share the pg-core schema and async query API. */
export type AppDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export const DEFAULT_SETTINGS: Record<string, string> = {
  public_creation_enabled: "true",
  anonymous_click_counting: "true",
  default_public_expiry_hours: "720", // 30 days
  allow_public_custom_slugs: "true",
};

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS links (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    destination_url TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('admin', 'public')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'flagged')),
    redirect_code INTEGER NOT NULL DEFAULT 302,
    password_hash TEXT,
    clicks INTEGER NOT NULL DEFAULT 0,
    max_clicks INTEGER,
    expires_at BIGINT,
    note TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_links_owner_status ON links(owner_type, status)`,
  `CREATE INDEX IF NOT EXISTS idx_links_expires_at ON links(expires_at)`,
  `CREATE TABLE IF NOT EXISTS abuse_reports (
    id SERIAL PRIMARY KEY,
    link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK(reason IN ('phishing', 'malware', 'spam', 'illegal', 'other')),
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'dismissed')),
    created_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_abuse_reports_link_id ON abuse_reports(link_id)`,
  `CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status)`,
  `CREATE TABLE IF NOT EXISTS blocked_domains (
    id SERIAL PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limit_hits (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_key ON rate_limit_hits(key)`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_created_at ON rate_limit_hits(created_at)`,
  `CREATE TABLE IF NOT EXISTS pow_used_challenges (
    challenge_id TEXT PRIMARY KEY,
    expires_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pow_used_challenges_expires_at ON pow_used_challenges(expires_at)`,
];

let cachedDbPromise: Promise<AppDatabase> | null = null;
let cachedKey = "";
let cachedPglite: PGlite | null = null;

async function bootstrapSchema(db: AppDatabase): Promise<void> {
  for (const statement of DDL) {
    await db.execute(sql.raw(statement));
  }

  const now = Date.now();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db
      .insert(schema.settings)
      .values({ key, value, updatedAt: now })
      .onConflictDoNothing();
  }
}

async function createDb(env: AppEnv): Promise<AppDatabase> {
  let db: AppDatabase;

  if (env.DATABASE_DRIVER === "neon") {
    if (!env.DATABASE_URL.startsWith("postgres://") &&
        !env.DATABASE_URL.startsWith("postgresql://")) {
      throw new Error(
        'DATABASE_DRIVER="neon" requires DATABASE_URL to be a Neon PostgreSQL connection string.'
      );
    }
    db = drizzleNeon(neon(env.DATABASE_URL), { schema });
  } else {
    // PGlite is a real embedded PostgreSQL: file-backed for local dev/Docker,
    // in-memory for tests. It is never loaded by the Neon production path.
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const dbUrl = env.DATABASE_URL || "./data/pgdata";
    const dataDir = dbUrl === "memory://" ? undefined : dbUrl;
    if (dataDir) {
      const fs = await import("node:fs");
      const path = await import("node:path");
      fs.mkdirSync(path.resolve(dataDir), { recursive: true });
    }
    cachedPglite = new PGlite(dataDir);
    await cachedPglite.waitReady;
    db = drizzlePglite(cachedPglite, { schema });
  }

  await bootstrapSchema(db);
  return db;
}

export async function getDb(): Promise<AppDatabase> {
  const env = getEnv();
  const key = `${env.DATABASE_DRIVER}:${env.DATABASE_URL}`;
  if (cachedDbPromise && cachedKey === key) {
    return cachedDbPromise;
  }

  cachedDbPromise = createDb(env).catch((err) => {
    cachedDbPromise = null;
    cachedKey = "";
    throw err;
  });
  cachedKey = key;
  return cachedDbPromise;
}

/** Recreate the embedded database so tests start from an empty schema. */
export async function resetDbForTesting(): Promise<void> {
  if (cachedPglite) {
    await cachedPglite.close();
    cachedPglite = null;
  }
  cachedDbPromise = null;
  cachedKey = "";
}
