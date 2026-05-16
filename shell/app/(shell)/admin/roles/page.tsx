import { db } from "@/lib/db/client";
import { roles, userRoles, idpGroupRoleMappings } from "@/lib/db/schema";
import { asc, sql } from "drizzle-orm";
import { RoleManagerClient } from "./role-manager-client";

export default async function RoleManagerPage() {
  const allRoles = await db
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

  const mappings = await db.select().from(idpGroupRoleMappings);

  return <RoleManagerClient roles={allRoles} mappings={mappings} />;
}
