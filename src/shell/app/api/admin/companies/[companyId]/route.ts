import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-guard";
import { updateCompany, deleteCompany } from "@/lib/actions/companies";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const rolesErr = await requireRoles(["super_admin", "admin"]);
  if (rolesErr) return rolesErr;

  const { companyId } = await params;
  const body = (await req.json()) as {
    name?: string;
    logoUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  };

  await updateCompany(companyId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const rolesErr = await requireRoles(["super_admin", "admin"]);
  if (rolesErr) return rolesErr;

  const { companyId } = await params;

  try {
    await deleteCompany(companyId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
