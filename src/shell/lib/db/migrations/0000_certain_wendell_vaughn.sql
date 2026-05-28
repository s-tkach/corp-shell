CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended', 'deleted');
--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled');
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "public"."tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"level" integer NOT NULL,
	"upgrade_cta_headline" text,
	"upgrade_cta_body" text,
	"upgrade_cta_label" text,
	"upgrade_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_tiers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tenant_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"status" "public"."subscription_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_subscription_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "app_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"remote_url" text NOT NULL,
	"route_prefix" text NOT NULL,
	"health_check_url" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_healthy_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_registry_name_unique" UNIQUE("name"),
	CONSTRAINT "app_registry_route_prefix_unique" UNIQUE("route_prefix")
);
--> statement-breakpoint
ALTER TABLE "tenant_subscription" ADD CONSTRAINT "tenant_subscription_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_subscription" ADD CONSTRAINT "tenant_subscription_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE no action ON UPDATE no action;
