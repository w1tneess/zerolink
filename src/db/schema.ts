import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  index,
} from "drizzle-orm/pg-core";

export const links = pgTable(
  "links",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    destinationUrl: text("destination_url").notNull(),
    ownerType: text("owner_type", { enum: ["admin", "public"] }).notNull(),
    status: text("status", { enum: ["active", "disabled", "flagged"] })
      .notNull()
      .default("active"),
    redirectCode: integer("redirect_code").notNull().default(302),
    passwordHash: text("password_hash"),
    clicks: integer("clicks").notNull().default(0),
    maxClicks: integer("max_clicks"),
    // Millisecond timestamps exceed int32, so they must be bigint in Postgres.
    expiresAt: bigint("expires_at", { mode: "number" }),
    note: text("note"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_links_owner_status").on(table.ownerType, table.status),
    index("idx_links_expires_at").on(table.expiresAt),
  ]
);

export const abuseReports = pgTable(
  "abuse_reports",
  {
    id: serial("id").primaryKey(),
    linkId: integer("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    reason: text("reason", {
      enum: ["phishing", "malware", "spam", "illegal", "other"],
    }).notNull(),
    details: text("details"),
    status: text("status", { enum: ["open", "resolved", "dismissed"] })
      .notNull()
      .default("open"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_abuse_reports_link_id").on(table.linkId),
    index("idx_abuse_reports_status").on(table.status),
  ]
);

export const blockedDomains = pgTable("blocked_domains", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

/**
 * Shared security state. Serverless functions must not rely on process memory:
 * each invocation may run in a different isolate with its own module state.
 */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: serial("id").primaryKey(),
    // HMAC of bucket + client IP; the raw address is never stored.
    key: text("key").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_rate_limit_hits_key").on(table.key),
    index("idx_rate_limit_hits_created_at").on(table.createdAt),
  ]
);

export const powUsedChallenges = pgTable(
  "pow_used_challenges",
  {
    challengeId: text("challenge_id").primaryKey(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_pow_used_challenges_expires_at").on(table.expiresAt),
  ]
);

export type LinkRecord = typeof links.$inferSelect;
export type NewLinkRecord = typeof links.$inferInsert;
export type AbuseReportRecord = typeof abuseReports.$inferSelect;
export type BlockedDomainRecord = typeof blockedDomains.$inferSelect;
export type SettingRecord = typeof settings.$inferSelect;
