import postgres from "postgres";
import { db, connectionString } from "./client";
import { tenants, subscriptionTiers, tenantSubscription, shellConfig, roles, users, userRoles } from "./schema";
import { eq } from "drizzle-orm";
import { withTenant } from "./tenant";
import { getPlatformSlug } from "@/lib/tenant-resolver";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function autoBootstrapPlatform(): Promise<void> {
  const existing = await db.select({ id: tenants.id }).from(tenants).limit(1);
  if (existing.length > 0) return;

  try {
    await provisionTenant(getPlatformSlug(), "Platform Admin", "", { setupComplete: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) return;
    throw e;
  }

  // Seed platform-level tables once after first tenant is created
  await seedPlatformDefaults();
}

async function seedPlatformDefaults(): Promise<void> {
  const existingTiers = await db.select({ id: subscriptionTiers.id }).from(subscriptionTiers).limit(1);
  if (existingTiers.length > 0) return;

  await db.insert(subscriptionTiers).values([
    { slug: "free", displayName: "Free", level: 0 },
    { slug: "standard", displayName: "Standard", level: 1 },
    { slug: "enterprise", displayName: "Enterprise", level: 2 },
  ]);
}

export async function provisionTenant(
  slug: string,
  displayName: string,
  adminEmail: string,
  options?: { setupComplete?: boolean }
): Promise<{ tenantId: string }> {
  // Validate slug
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("Invalid slug");
  }

  // Check slug uniqueness
  const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (existing.length > 0) {
    throw new Error(`Slug "${slug}" already exists`);
  }

  // Create postgres connection for raw SQL
  const sql = postgres(connectionString!);

  try {
    // Insert tenant row
    const [tenant] = await db
      .insert(tenants)
      .values({
        slug,
        displayName,
        status: "active",
      })
      .returning();

    if (!tenant) {
      throw new Error("Failed to create tenant");
    }

    // Assign free tier subscription in the platform schema
    const freeTierRows = await db
      .select({ id: subscriptionTiers.id })
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.slug, "free"))
      .limit(1);
    const freeTier = freeTierRows[0];
    if (freeTier) {
      await db.insert(tenantSubscription).values({
        tenantId: tenant.id,
        tierId: freeTier.id,
        status: "active",
      });
    }

    // Create schema
    const schemaName = `tenant_${slug}`;
    await sql.unsafe(`CREATE SCHEMA "${schemaName}"`);

    // Run DDL for per-tenant tables
    const ddl = perTenantDDL(schemaName);
    await sql.unsafe(ddl);

    // Seed defaults
    const tenantDb = withTenant(slug);
    await seedTenant(tenantDb, tenant.id, adminEmail, options?.setupComplete ?? true);

    return { tenantId: tenant.id };
  } finally {
    await sql.end();
  }
}

export function perTenantDDL(schema: string): string {
  return `
    SET search_path TO "${schema}",public;

    CREATE TABLE "${schema}".roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE,
      display_name text NOT NULL,
      is_system boolean NOT NULL DEFAULT false,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE "${schema}".users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      display_name text NOT NULL,
      idp_source text NOT NULL,
      idp_subject text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      preferences jsonb,
      last_login_at timestamp with time zone,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE "${schema}".user_roles (
      user_id uuid NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      role_id uuid NOT NULL REFERENCES "${schema}".roles(id) ON DELETE CASCADE,
      assigned_at timestamp with time zone NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE "${schema}".idp_group_role_mappings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      idp_group_name text NOT NULL,
      role_id uuid NOT NULL REFERENCES "${schema}".roles(id) ON DELETE CASCADE,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      UNIQUE(idp_group_name, role_id)
    );

    CREATE TABLE "${schema}".idp_providers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL UNIQUE,
      display_name text NOT NULL,
      issuer text NOT NULL,
      client_id text NOT NULL,
      encrypted_client_secret text NOT NULL,
      scopes text[] NOT NULL,
      token_endpoint_auth_method text NOT NULL DEFAULT 'client_secret_post',
      group_claim_name text,
      is_enabled boolean NOT NULL DEFAULT true,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE "${schema}".shell_config (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_name text NOT NULL,
      logo_url text,
      color_overrides jsonb,
      color_overrides_dark jsonb,
      login_bg_image_url text,
      login_bg_color text,
      login_headline text,
      login_form_position text,
      login_card_color text,
      login_button_color text,
      login_button_text text,
      header_show_date boolean NOT NULL DEFAULT false,
      header_date_format text DEFAULT 'PPP',
      toast_position text DEFAULT 'bottom-right',
      toast_bg_color text DEFAULT '#ffffff',
      toast_text_color text DEFAULT '#020817',
      toast_border_color text DEFAULT '#e2e8f0',
      toast_duration integer DEFAULT 5000,
      setup_complete boolean NOT NULL DEFAULT false,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE "${schema}".auth_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES "${schema}".users(id) ON DELETE SET NULL,
      email text,
      event_type text NOT NULL,
      metadata jsonb,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE "${schema}".notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      body text NOT NULL,
      action_label text,
      action_type text,
      action_payload text,
      target_type text NOT NULL DEFAULT 'all',
      target_user_id uuid REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      target_sub_level integer,
      expires_at timestamp with time zone,
      created_by uuid NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE "${schema}".notification_reads (
      notification_id uuid NOT NULL REFERENCES "${schema}".notifications(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      read_at timestamp with time zone NOT NULL DEFAULT now(),
      PRIMARY KEY (notification_id, user_id)
    );

    CREATE TABLE "${schema}".menu_item_roles (
      menu_item_id uuid NOT NULL,
      role_id uuid NOT NULL REFERENCES "${schema}".roles(id) ON DELETE CASCADE,
      PRIMARY KEY (menu_item_id, role_id)
    );
  `;
}

async function seedTenant(
  tenantDb: ReturnType<typeof withTenant>,
  _tenantId: string,
  adminEmail: string,
  setupComplete = true
): Promise<void> {
  // Insert default roles
  const superAdminRoles = await tenantDb
    .insert(roles)
    .values({
      slug: "super_admin",
      displayName: "Super Admin",
      isSystem: true,
    })
    .returning();

  const superAdminRole = superAdminRoles[0];
  if (!superAdminRole) {
    throw new Error("Failed to create super_admin role");
  }

  await tenantDb
    .insert(roles)
    .values({
      slug: "admin",
      displayName: "Admin",
      isSystem: true,
    });

  await tenantDb
    .insert(roles)
    .values({
      slug: "user",
      displayName: "User",
      isSystem: true,
    });

  // Insert shell config with defaults
  await tenantDb
    .insert(shellConfig)
    .values({
      appName: "Shell",
      setupComplete,
    });

  if (adminEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      throw new Error(`Invalid email format: "${adminEmail}"`);
    }

    const adminUsers = await tenantDb
      .insert(users)
      .values({
        email: adminEmail,
        displayName: adminEmail.split("@")[0] ?? "admin",
        idpSource: "pending",
        idpSubject: "pending",
        isActive: true,
      })
      .returning();

    const adminUser = adminUsers[0];
    if (!adminUser) {
      throw new Error("Failed to create admin user");
    }

    await tenantDb
      .insert(userRoles)
      .values({
        userId: adminUser.id,
        roleId: superAdminRole.id,
      });
  }
}
