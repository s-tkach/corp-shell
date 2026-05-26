import { getPlatformSlug } from "@/lib/tenant-resolver";

interface UserLike {
  roles: string[];
  tenantSlug: string;
}

export function isPlatformAdmin(user: UserLike): boolean {
  return user.tenantSlug === getPlatformSlug() && user.roles.includes("super_admin");
}
