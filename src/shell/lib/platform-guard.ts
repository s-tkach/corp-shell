interface UserLike {
  roles: string[];
  tenantSlug: string;
}

export function isPlatformAdmin(user: UserLike): boolean {
  return user.tenantSlug === "platform" && user.roles.includes("super_admin");
}
