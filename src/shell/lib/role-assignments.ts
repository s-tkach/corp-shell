import { eq, inArray } from "drizzle-orm";
import { withTenant } from "@/lib/db/tenant";
import {
  idpGroupRoleMappings,
  roles,
  userIdpRoles,
  userRoles,
} from "@/lib/db/schema";
import {
  mergeEffectiveRoleAssignments,
  type EffectiveRoleAssignments,
  type RoleAssignment,
} from "@/lib/effective-roles";

type TenantDb = ReturnType<typeof withTenant>;

async function getManualRoles(tenantDb: TenantDb, userId: string): Promise<RoleAssignment[]> {
  return tenantDb
    .select({ slug: roles.slug, displayName: roles.displayName })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
}

async function getIdpRoles(tenantDb: TenantDb, userId: string): Promise<RoleAssignment[]> {
  return tenantDb
    .select({ slug: roles.slug, displayName: roles.displayName })
    .from(userIdpRoles)
    .innerJoin(roles, eq(userIdpRoles.roleId, roles.id))
    .where(eq(userIdpRoles.userId, userId));
}

export async function getEffectiveRoleAssignmentsForUser(
  tenantDb: TenantDb,
  userId: string
): Promise<EffectiveRoleAssignments> {
  const [manualRoles, idpRoles] = await Promise.all([
    getManualRoles(tenantDb, userId),
    getIdpRoles(tenantDb, userId),
  ]);

  return mergeEffectiveRoleAssignments({ manualRoles, idpRoles });
}

export async function getMappedIdpRoleSlugs(
  tenantDb: TenantDb,
  idpGroups: string[]
): Promise<string[]> {
  if (idpGroups.length === 0) {
    return [];
  }

  const mappings = await tenantDb
    .select({ slug: roles.slug })
    .from(idpGroupRoleMappings)
    .innerJoin(roles, eq(idpGroupRoleMappings.roleId, roles.id))
    .where(inArray(idpGroupRoleMappings.idpGroupName, idpGroups));

  return [...new Set(mappings.map((mapping) => mapping.slug))];
}

export async function replaceIdpRoleAssignmentsForUser(
  tenantDb: TenantDb,
  userId: string,
  roleSlugs: string[]
): Promise<void> {
  await tenantDb.delete(userIdpRoles).where(eq(userIdpRoles.userId, userId));

  if (roleSlugs.length === 0) {
    return;
  }

  const roleRows = await tenantDb
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.slug, roleSlugs));

  if (roleRows.length === 0) {
    return;
  }

  await tenantDb.insert(userIdpRoles).values(
    roleRows.map((role) => ({
      userId,
      roleId: role.id,
    }))
  );
}
