import { describe, expect, it } from "vitest";
import {
  buildVisibleMenuTree,
  getRequiredSubscriptionLevelForRoute,
} from "@/lib/menu-resolver";

const tiers = [
  { id: "tier-free", level: 0 },
  { id: "tier-standard", level: 1 },
  { id: "tier-enterprise", level: 2 },
];

const sections = [
  { id: "section-main", label: "Main", icon: null, sortOrder: 0 },
  { id: "section-platform", label: "Platform", icon: null, sortOrder: 1 },
];

const items = [
  {
    id: "item-dashboard",
    sectionId: "section-main",
    parentItemId: null,
    isFolder: false,
    label: "Dashboard",
    route: "/dashboard",
    icon: null,
    badge: null,
    subscriptionTierId: "tier-free",
    sortOrder: 0,
  },
  {
    id: "item-reports",
    sectionId: "section-main",
    parentItemId: null,
    isFolder: false,
    label: "Reports",
    route: "/reports",
    icon: null,
    badge: null,
    subscriptionTierId: "tier-standard",
    sortOrder: 1,
  },
  {
    id: "item-enterprise",
    sectionId: "section-main",
    parentItemId: null,
    isFolder: false,
    label: "Enterprise",
    route: "/enterprise",
    icon: null,
    badge: null,
    subscriptionTierId: "tier-enterprise",
    sortOrder: 2,
  },
  {
    id: "item-tools",
    sectionId: "section-main",
    parentItemId: null,
    isFolder: true,
    label: "Tools",
    route: "",
    icon: null,
    badge: null,
    subscriptionTierId: "tier-standard",
    sortOrder: 3,
  },
  {
    id: "item-tool-child",
    sectionId: "section-main",
    parentItemId: "item-tools",
    isFolder: false,
    label: "Tool Child",
    route: "/tools/child",
    icon: null,
    badge: null,
    subscriptionTierId: "tier-standard",
    sortOrder: 0,
  },
  {
    id: "item-platform",
    sectionId: "section-platform",
    parentItemId: null,
    isFolder: false,
    label: "Tenants",
    route: "/platform/tenants",
    icon: null,
    badge: null,
    subscriptionTierId: null,
    sortOrder: 0,
  },
];

describe("buildVisibleMenuTree", () => {
  it("shows only free-tier items for a free tenant", () => {
    const tree = buildVisibleMenuTree({
      sections,
      items,
      tiers,
      subscriptionLevel: 0,
      userRoles: ["user"],
      requiredRolesByItemId: new Map(),
      isPlatformAdmin: false,
    });

    expect(tree).toHaveLength(1);
    expect(tree[0]?.items.map((item) => item.label)).toEqual(["Dashboard"]);
  });

  it("inherits lower-tier items for a higher-tier tenant", () => {
    const tree = buildVisibleMenuTree({
      sections,
      items,
      tiers,
      subscriptionLevel: 1,
      userRoles: ["user"],
      requiredRolesByItemId: new Map(),
      isPlatformAdmin: false,
    });

    expect(tree).toHaveLength(1);
    expect(tree[0]?.items.map((item) => item.label)).toEqual([
      "Dashboard",
      "Reports",
      "Tools",
    ]);
    expect(tree[0]?.items.find((item) => item.label === "Tools")?.children.map((item) => item.label)).toEqual([
      "Tool Child",
    ]);
  });

  it("hides platform-only items from non-platform tenants", () => {
    const tree = buildVisibleMenuTree({
      sections,
      items,
      tiers,
      subscriptionLevel: 2,
      userRoles: ["super_admin"],
      requiredRolesByItemId: new Map(),
      isPlatformAdmin: false,
    });

    expect(tree.some((section) => section.label === "Platform")).toBe(false);
  });

  it("shows platform-only items to platform admins", () => {
    const tree = buildVisibleMenuTree({
      sections,
      items,
      tiers,
      subscriptionLevel: 2,
      userRoles: ["super_admin"],
      requiredRolesByItemId: new Map(),
      isPlatformAdmin: true,
    });

    expect(tree.find((section) => section.label === "Platform")?.items.map((item) => item.label)).toEqual([
      "Tenants",
    ]);
  });

  it("hides a shared item when the tenant assigned roles and the user lacks them", () => {
    const tree = buildVisibleMenuTree({
      sections,
      items,
      tiers,
      subscriptionLevel: 1,
      userRoles: ["user"],
      requiredRolesByItemId: new Map([["item-reports", ["admin"]]]),
      isPlatformAdmin: false,
    });

    expect(tree[0]?.items.map((item) => item.label)).toEqual([
      "Dashboard",
      "Tools",
    ]);
  });

  it("shows a shared item to all authenticated users when no tenant roles are assigned", () => {
    const tree = buildVisibleMenuTree({
      sections,
      items,
      tiers,
      subscriptionLevel: 1,
      userRoles: ["user"],
      requiredRolesByItemId: new Map(),
      isPlatformAdmin: false,
    });

    expect(tree[0]?.items.map((item) => item.label)).toContain("Reports");
  });
});

describe("getRequiredSubscriptionLevelForRoute", () => {
  it("returns the owning tier level for a matched route", () => {
    expect(
      getRequiredSubscriptionLevelForRoute({
        items,
        tiers,
        pathname: "/reports",
      })
    ).toBe(1);
  });

  it("returns null for free-tier routes", () => {
    expect(
      getRequiredSubscriptionLevelForRoute({
        items,
        tiers,
        pathname: "/dashboard",
      })
    ).toBeNull();
  });

  it("returns null for platform-only routes", () => {
    expect(
      getRequiredSubscriptionLevelForRoute({
        items,
        tiers,
        pathname: "/platform/tenants",
      })
    ).toBeNull();
  });
});
