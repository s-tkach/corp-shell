import { getTenantDb } from "@/lib/db/tenant";
import { subscriptionTiers, tenantSubscription } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { SubscriptionTiersClient } from "./subscription-tiers-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SubscriptionTiersPage() {
  const tenantDb = await getTenantDb();

  const [tiers, orgSubRows] = await Promise.all([
    tenantDb.select().from(subscriptionTiers).orderBy(asc(subscriptionTiers.level)),
    tenantDb
      .select({
        status: tenantSubscription.status,
        expiresAt: tenantSubscription.expiresAt,
        assignedAt: tenantSubscription.assignedAt,
        tierDisplayName: subscriptionTiers.displayName,
        tierLevel: subscriptionTiers.level,
        upgradeUrl: subscriptionTiers.upgradeUrl,
      })
      .from(tenantSubscription)
      .innerJoin(subscriptionTiers, eq(tenantSubscription.tierId, subscriptionTiers.id))
      .limit(1),
  ]);

  const orgSub = orgSubRows[0] ?? null;

  return (
    <div className="space-y-8">
      {orgSub && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Subscription</CardTitle>
            <p className="text-sm text-muted-foreground">Assigned by platform admin — contact support to change your tier.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-medium">{orgSub.tierDisplayName}</span>
              <Badge variant="secondary">Level {orgSub.tierLevel}</Badge>
              <Badge variant={orgSub.status === "active" ? "default" : "destructive"}>
                {orgSub.status}
              </Badge>
            </div>
            {orgSub.expiresAt && (
              <p className="text-sm text-muted-foreground">
                Expires: {new Date(orgSub.expiresAt).toLocaleDateString()}
              </p>
            )}
            {orgSub.upgradeUrl && (
              <a
                href={orgSub.upgradeUrl}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Upgrade plan →
              </a>
            )}
          </CardContent>
        </Card>
      )}
      <SubscriptionTiersClient tiers={tiers} />
    </div>
  );
}
