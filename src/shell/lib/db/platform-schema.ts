import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "suspended",
  "deleted",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  status: tenantStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionTiers = pgTable("subscription_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  level: integer("level").notNull(),
  upgradeCtaHeadline: text("upgrade_cta_headline"),
  upgradeCtaBody: text("upgrade_cta_body"),
  upgradeCtaLabel: text("upgrade_cta_label"),
  upgradeUrl: text("upgrade_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantSubscription = pgTable("tenant_subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  tierId: uuid("tier_id")
    .notNull()
    .references(() => subscriptionTiers.id),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appRegistry = pgTable("app_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  remoteUrl: text("remote_url").notNull(),
  routePrefix: text("route_prefix").notNull().unique(),
  healthCheckUrl: text("health_check_url"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastHealthyAt: timestamp("last_healthy_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

