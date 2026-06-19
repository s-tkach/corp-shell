import { describe, expect, it } from "vitest";
import { mergeEffectiveRoleAssignments } from "@/lib/effective-roles";

describe("mergeEffectiveRoleAssignments", () => {
  it("returns manual, idp-derived, and effective roles separately", () => {
    expect(
      mergeEffectiveRoleAssignments({
        manualRoles: [
          { slug: "admin", displayName: "Admin" },
          { slug: "finance_manager", displayName: "Finance Manager" },
        ],
        idpRoles: [
          { slug: "finance_manager", displayName: "Finance Manager" },
          { slug: "user", displayName: "User" },
        ],
      })
    ).toEqual({
      manualRoles: [
        { slug: "admin", displayName: "Admin" },
        { slug: "finance_manager", displayName: "Finance Manager" },
      ],
      idpRoles: [
        { slug: "finance_manager", displayName: "Finance Manager" },
        { slug: "user", displayName: "User" },
      ],
      effectiveRoles: [
        { slug: "admin", displayName: "Admin" },
        { slug: "finance_manager", displayName: "Finance Manager" },
        { slug: "user", displayName: "User" },
      ],
    });
  });

  it("deduplicates repeated slugs inside and across role sources", () => {
    expect(
      mergeEffectiveRoleAssignments({
        manualRoles: [
          { slug: "admin", displayName: "Admin" },
          { slug: "admin", displayName: "Admin" },
        ],
        idpRoles: [
          { slug: "admin", displayName: "Admin" },
          { slug: "user", displayName: "User" },
          { slug: "user", displayName: "User" },
        ],
      }).effectiveRoles
    ).toEqual([
      { slug: "admin", displayName: "Admin" },
      { slug: "user", displayName: "User" },
    ]);
  });
});
