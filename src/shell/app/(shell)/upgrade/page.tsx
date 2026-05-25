import Link from "next/link";
import { getTenantDb } from "@/lib/db/tenant";
import { subscriptionTiers } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

interface Props {
  searchParams: Promise<{ from?: string; level?: string }>;
}

export default async function UpgradePage({ searchParams }: Props) {
  const { from, level } = await searchParams;
  const requiredLevel = level ? parseInt(level, 10) : 1;

  const tenantDb = await getTenantDb();
  const tiers = await tenantDb
    .select()
    .from(subscriptionTiers)
    .orderBy(asc(subscriptionTiers.level));

  const requiredTier = tiers.find((t) => t.level >= requiredLevel);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-lg mx-auto">
      <h1 className="text-3xl font-bold">
        {requiredTier?.upgradeCtaHeadline ?? "Upgrade Required"}
      </h1>
      <p className="text-muted-foreground">
        {requiredTier?.upgradeCtaBody ??
          "This feature requires a higher subscription tier. Please upgrade to continue."}
      </p>
      <div className="flex gap-3">
        {requiredTier?.upgradeUrl && (
          <a
            href={requiredTier.upgradeUrl}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            {requiredTier.upgradeCtaLabel ?? "Upgrade Now"}
          </a>
        )}
        <Link
          href={from ?? "/dashboard"}
          className="inline-flex items-center justify-center rounded-md border px-6 py-2 text-sm font-medium hover:bg-accent"
        >
          Go Back
        </Link>
      </div>
    </div>
  );
}
