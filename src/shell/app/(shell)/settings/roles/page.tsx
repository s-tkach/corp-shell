import { getTenantDb } from "@/lib/db/tenant";
import { roles, userRoles, userIdpRoles, idpGroupRoleMappings } from "@/lib/db/schema";
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
      userCount: sql<number>`(
        select count(distinct assignments.user_id)
        from (
          select ${userRoles.userId} as user_id, ${userRoles.roleId} as role_id from ${userRoles}
          union all
          select ${userIdpRoles.userId} as user_id, ${userIdpRoles.roleId} as role_id from ${userIdpRoles}
        ) assignments
        where assignments.role_id = ${roles.id}
      )`.mapWith(Number),
    })
    .from(roles)
    .orderBy(asc(roles.displayName));

  const mappings = await tenantDb.select().from(idpGroupRoleMappings);

  return <RoleManagerClient roles={allRoles} mappings={mappings} />;
}
