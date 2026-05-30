"use server";

import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/db/tenant";
import { companies, companyAncestors, userCompanies } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PgDatabase } from "drizzle-orm/pg-core";

async function getTenantDb() {
  const session = await auth();
  const slug = session?.user.tenantSlug;
  if (!slug) throw new Error("Unauthorized");
  return withTenant(slug);
}

// Insert closure table rows for a newly created company.
// Copies all ancestor rows of the parent, then adds the self-reference.
// Accepts both a db instance and a transaction (compatible Drizzle base type).
async function insertAncestors(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>,
  companyId: string,
  parentId: string | null
) {
  const selfRow = { ancestorId: companyId, descendantId: companyId, depth: 0 };

  if (!parentId) {
    await db.insert(companyAncestors).values(selfRow);
    return;
  }

  // Copy parent's ancestors, incrementing depth by 1
  const parentAncestorRows = await db
    .select({ ancestorId: companyAncestors.ancestorId, depth: companyAncestors.depth })
    .from(companyAncestors)
    .where(eq(companyAncestors.descendantId, parentId));

  const rows = [
    ...parentAncestorRows.map((r) => ({
      ancestorId: r.ancestorId,
      descendantId: companyId,
      depth: r.depth + 1,
    })),
    selfRow,
  ];

  await db.insert(companyAncestors).values(rows);
}

export async function createCompany(data: {
  name: string;
  parentId: string | null;
  logoUrl?: string | null;
  sortOrder?: number;
}) {
  const db = await getTenantDb();

  const company = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(companies)
      .values({
        name: data.name,
        parentId: data.parentId,
        logoUrl: data.logoUrl ?? null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning({ id: companies.id });

    const row = inserted[0];
    if (!row) throw new Error("Failed to create company");

    await insertAncestors(tx, row.id, data.parentId);
    return row;
  });

  revalidatePath("/settings/companies");
  return company;
}

export async function updateCompany(
  companyId: string,
  data: { name?: string; logoUrl?: string | null; sortOrder?: number; isActive?: boolean }
) {
  const db = await getTenantDb();
  await db.update(companies).set(data).where(eq(companies.id, companyId));
  revalidatePath("/settings/companies");
}

export async function deleteCompany(companyId: string) {
  const db = await getTenantDb();
  // Block deletion if any children exist, active or inactive
  const children = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.parentId, companyId))
    .limit(1);
  if (children.length > 0) throw new Error("Cannot delete a company that has children");

  await db.delete(companies).where(eq(companies.id, companyId));
  revalidatePath("/settings/companies");
}

export async function setUserCompanies(userId: string, companyIds: string[]) {
  const db = await getTenantDb();
  // Replace all assignments for this user
  await db.delete(userCompanies).where(eq(userCompanies.userId, userId));
  if (companyIds.length > 0) {
    await db.insert(userCompanies).values(
      companyIds.map((companyId) => ({ userId, companyId }))
    );
  }
  revalidatePath("/settings/users");
}

export async function switchActiveCompany(companyId: string | null) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  if (companyId === null) return { companyId: null };

  const db = withTenant(session.user.tenantSlug);
  const hasAccess = await db
    .select({ id: companyAncestors.descendantId })
    .from(companyAncestors)
    .where(
      and(
        eq(companyAncestors.descendantId, companyId),
        inArray(
          companyAncestors.ancestorId,
          session.user.companyIds.length > 0 ? session.user.companyIds : ["__none__"]
        )
      )
    )
    .limit(1);

  if (hasAccess.length === 0) throw new Error("Access denied");
  return { companyId };
}
