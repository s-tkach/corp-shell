export interface RoleAssignment {
  slug: string;
  displayName: string;
}

export interface EffectiveRoleAssignments {
  manualRoles: RoleAssignment[];
  idpRoles: RoleAssignment[];
  effectiveRoles: RoleAssignment[];
}

function dedupeRoles(roles: RoleAssignment[]): RoleAssignment[] {
  const deduped = new Map<string, RoleAssignment>();

  for (const role of roles) {
    if (!deduped.has(role.slug)) {
      deduped.set(role.slug, role);
    }
  }

  return [...deduped.values()];
}

export function mergeEffectiveRoleAssignments({
  manualRoles,
  idpRoles,
}: {
  manualRoles: RoleAssignment[];
  idpRoles: RoleAssignment[];
}): EffectiveRoleAssignments {
  const dedupedManualRoles = dedupeRoles(manualRoles);
  const dedupedIdpRoles = dedupeRoles(idpRoles);

  return {
    manualRoles: dedupedManualRoles,
    idpRoles: dedupedIdpRoles,
    effectiveRoles: dedupeRoles([...dedupedManualRoles, ...dedupedIdpRoles]),
  };
}
