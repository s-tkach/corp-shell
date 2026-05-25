import { getTenantDb } from "@/lib/db/tenant";
import { roles, userRoles, idpGroupRoleMappings } from "@/lib/db/schema";
import { asc, sql } from "drizzle-orm";
import { RoleManagerClient } from "./role-manager-client";

export default async function RoleManagerPage() {
  const tenantDb = await getTenantDb();
  const allRoles = await tenantDb
    .select({
      id: roles.id,
      slug: roles.slug,
      displayName: roles.displayName,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
      userCount: sql<number>`(select count(*) from ${userRoles} where ${userRoles.roleId} = ${roles.id})`.mapWith(Number),
    })
    .from(roles)
    .orderBy(asc(roles.displayName));

  const mappings = await tenantDb.select().from(idpGroupRoleMappings);

  return <RoleManagerClient roles={allRoles} mappings={mappings} />;
}
