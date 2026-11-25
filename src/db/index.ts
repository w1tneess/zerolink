import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

let cachedDb: AppDatabase | null = null;
let cachedSqlite: Database.Database | null = null;
let cachedUrl: string | null = null;

export const DEFAULT_SETTINGS: Record<string, string> = {
  public_creation_enabled: "true",
  anonymous_click_counting: "true",
  default_public_expiry_hours: "720", // 30 days
  allow_public_custom_slugs: "true",
};

function bootstrapSchema(sqlite: Database.Database): void {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      destination_url TEXT NOT NULL,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('admin', 'public')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'flagged')),
      redirect_code INTEGER NOT NULL DEFAULT 302,
      password_hash TEXT,
      clicks INTEGER NOT NULL DEFAULT 0,
      max_clicks INTEGER,
      expires_at INTEGER,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_links_owner_status ON links(owner_type, status);
    CREATE INDEX IF NOT EXISTS idx_links_expires_at ON links(expires_at);

    CREATE TABLE IF NOT EXISTS abuse_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      reason TEXT NOT NULL CHECK(reason IN ('phishing', 'malware', 'spam', 'illegal', 'other')),
      details TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'dismissed')),
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_abuse_reports_link_id ON abuse_reports(link_id);
    CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status);

    CREATE TABLE IF NOT EXISTS blocked_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      reason TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const now = Date.now();
  const insertStmt = sqlite.prepare(
    `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`
  );
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insertStmt.run(key, value, now);
  }
}

export function getDb(): AppDatabase {
  const env = getEnv();
  if (env.DATABASE_DRIVER !== "sqlite") {
    throw new Error(
      `DATABASE_DRIVER="${env.DATABASE_DRIVER}" selected. Swap the Drizzle driver adapter in src/db/index.ts to connect to Turso/D1/PostgreSQL.`
    );
  }

  const dbUrl = env.DATABASE_URL;
  if (cachedDb && cachedUrl === dbUrl) {
    return cachedDb;
  }

  if (cachedSqlite) {
    cachedSqlite.close();
    cachedSqlite = null;
    cachedDb = null;
  }

  if (dbUrl !== ":memory:" && !dbUrl.startsWith("file:")) {
    const resolved = path.resolve(process.cwd(), dbUrl);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    cachedSqlite = new Database(resolved);
  } else {
    cachedSqlite = new Database(dbUrl);
  }

  bootstrapSchema(cachedSqlite);
  cachedDb = drizzle(cachedSqlite, { schema });
  cachedUrl = dbUrl;
  return cachedDb;
}

export function resetDbForTesting(): void {
  if (cachedSqlite) {
    cachedSqlite.close();
    cachedSqlite = null;
  }
  cachedDb = null;
  cachedUrl = null;
}
