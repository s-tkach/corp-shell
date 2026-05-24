import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      roles: string[];
      subscriptionTier: string;
      subscriptionLevel: number;
      tenantId: string;
      tenantSlug: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    roles?: string[];
    subscriptionTier?: string;
    subscriptionLevel?: number;
    idToken?: string;
    tenantId?: string;
    tenantSlug?: string;
  }
}
