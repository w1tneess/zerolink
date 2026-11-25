import {
  sqliteTable,
  integer,
  text,
  index,
} from "drizzle-orm/sqlite-core";

export const links = sqliteTable(
  "links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    expiresAt: integer("expires_at"),
    note: text("note"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_links_owner_status").on(table.ownerType, table.status),
    index("idx_links_expires_at").on(table.expiresAt),
  ]
);

export const abuseReports = sqliteTable(
  "abuse_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_abuse_reports_link_id").on(table.linkId),
    index("idx_abuse_reports_status").on(table.status),
  ]
);

export const blockedDomains = sqliteTable("blocked_domains", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  createdAt: integer("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type LinkRecord = typeof links.$inferSelect;
export type NewLinkRecord = typeof links.$inferInsert;
export type AbuseReportRecord = typeof abuseReports.$inferSelect;
export type BlockedDomainRecord = typeof blockedDomains.$inferSelect;
export type SettingRecord = typeof settings.$inferSelect;
