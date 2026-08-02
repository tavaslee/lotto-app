import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import type { LotteryType, PermissionOverrides } from "../shared/lottery";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  username: text("username"),
  usernameHash: varchar("usernameHash", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  notes: text("notes"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  activeMemberSessionId: varchar("activeMemberSessionId", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  memberLevel: mysqlEnum("memberLevel", ["regular", "premium"])
    .default("regular")
    .notNull(),
  memberStatus: mysqlEnum("memberStatus", ["active", "suspended", "pending"])
    .default("active")
    .notNull(),
  membershipExpiresAt: timestamp("membershipExpiresAt"),
  useCustomPermissions: boolean("useCustomPermissions").default(false).notNull(),
  customPermissions: json("customPermissions").$type<PermissionOverrides>(),
  allowedLotteryTypes: json("allowedLotteryTypes").$type<LotteryType[]>(),
  memberSyncStatus: mysqlEnum("memberSyncStatus", ["pending", "synced", "failed"])
    .default("pending")
    .notNull(),
  memberSyncedAt: timestamp("memberSyncedAt"),
  memberSyncError: text("memberSyncError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const carouselSlides = mysqlTable("carouselSlides", {
  id: int("id").autoincrement().primaryKey(),
  url: text("url").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 64 }).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const carouselSettings = mysqlTable("carouselSettings", {
  id: int("id").primaryKey(),
  isVisible: boolean("isVisible").default(false).notNull(),
  autoplay: boolean("autoplay").default(true).notNull(),
  intervalMs: int("intervalMs").default(1000).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const siteVisits = mysqlTable("siteVisits", {
  id: int("id").autoincrement().primaryKey(),
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  path: varchar("path", { length: 255 }).notNull(),
  referrerHost: varchar("referrerHost", { length: 255 }),
  device: mysqlEnum("device", ["desktop", "mobile", "tablet"]).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => [
  index("siteVisits_occurredAt_idx").on(table.occurredAt),
  index("siteVisits_visitor_time_idx").on(table.visitorId, table.occurredAt),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CarouselSlide = typeof carouselSlides.$inferSelect;
export type InsertCarouselSlide = typeof carouselSlides.$inferInsert;
export type CarouselSettings = typeof carouselSettings.$inferSelect;
export type SiteVisit = typeof siteVisits.$inferSelect;
export type InsertSiteVisit = typeof siteVisits.$inferInsert;

// TODO: Add your tables here
