import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  idpSource: text("idp_source").notNull(),
  idpSubject: text("idp_subject").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  preferences: jsonb("preferences"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.roleId)],
);

export const idpGroupRoleMappings = pgTable(
  "idp_group_role_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idpGroupName: text("idp_group_name").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.idpGroupName, t.roleId)],
);

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

export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  tierId: uuid("tier_id")
    .notNull()
    .references(() => subscriptionTiers.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const menuSections = pgTable("menu_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => menuSections.id, { onDelete: "cascade" }),
  parentItemId: uuid("parent_item_id"),
  isFolder: boolean("is_folder").notNull().default(false),
  label: text("label").notNull(),
  route: text("route").notNull().default(""),
  icon: text("icon"),
  badge: text("badge"),
  requiredRoles: jsonb("required_roles").$type<string[]>().notNull().default([]),
  requiredSubLevel: integer("required_sub_level").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

export const shellConfig = pgTable("shell_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  appName: text("app_name").notNull(),
  logoUrl: text("logo_url"),
  colorOverrides: jsonb("color_overrides").$type<Record<string, string>>(),
  colorOverridesDark: jsonb("color_overrides_dark").$type<Record<string, string>>(),
  loginBgImageUrl: text("login_bg_image_url"),
  loginBgColor: text("login_bg_color"),
  loginHeadline: text("login_headline"),
  loginFormPosition: text("login_form_position"),
  loginCardColor: text("login_card_color"),
  loginButtonColor: text("login_button_color"),
  loginButtonText: text("login_button_text"),
  oidcIssuer: text("oidc_issuer"),
  oidcClientId: text("oidc_client_id"),
  oidcClientSecret: text("oidc_client_secret"),
  headerShowDate: boolean("header_show_date").notNull().default(false),
  headerDateFormat: text("header_date_format").default("PPP"),
  toastPosition: text("toast_position").default("bottom-right"),
  toastBgColor: text("toast_bg_color").default("#ffffff"),
  toastTextColor: text("toast_text_color").default("#020817"),
  toastBorderColor: text("toast_border_color").default("#e2e8f0"),
  toastDuration: integer("toast_duration").default(5000),
  setupComplete: boolean("setup_complete").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authEvents = pgTable("auth_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email"),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  actionLabel: text("action_label"),
  actionType: text("action_type"),
  actionPayload: text("action_payload"),
  targetType: text("target_type").notNull().default("all"),
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }),
  targetSubLevel: integer("target_sub_level"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationReads = pgTable(
  "notification_reads",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.notificationId, t.userId)],
);
