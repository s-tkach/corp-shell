"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil } from "lucide-react";

interface Role {
  id: string;
  slug: string;
  displayName: string;
  isSystem: boolean;
  userCount: number;
}

interface Mapping {
  id: string;
  roleId: string;
  idpGroupName: string;
}

interface PlatformPolicy {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
}

interface Props {
  roles: Role[];
  mappings: Mapping[];
}

export function RoleManagerClient({ roles: initialRoles, mappings: initialMappings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [roleDialog, setRoleDialog] = useState<{ open: boolean; editing: Role | null }>({ open: false, editing: null });
  const [roleForm, setRoleForm] = useState({ slug: "", displayName: "" });

  const [mappingDialog, setMappingDialog] = useState<{ open: boolean; roleId: string | null }>({ open: false, roleId: null });
  const [mappingGroup, setMappingGroup] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [policyPanel, setPolicyPanel] = useState<{ roleId: string; roleName: string } | null>(null);
  const [allPolicies, setAllPolicies] = useState<PlatformPolicy[]>([]);
  const [assignedSlugs, setAssignedSlugs] = useState<string[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesSaving, setPoliciesSaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  function openNewRole() {
    setRoleForm({ slug: "", displayName: "" });
    setRoleDialog({ open: true, editing: null });
  }

  function openEditRole(role: Role) {
    setRoleForm({ slug: role.slug, displayName: role.displayName });
    setRoleDialog({ open: true, editing: role });
  }

  async function saveRole() {
    setError(null);
    const { editing } = roleDialog;
    if (editing) {
      const res = await fetch(`/api/admin/roles/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: roleForm.displayName }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to update role"); return; }
    } else {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleForm),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create role"); return; }
    }
    setRoleDialog({ open: false, editing: null });
    refresh();
  }

  async function deleteRole(id: string) {
    if (!confirm("Delete this role?")) return;
    const res = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json() as { error: string };
      alert(data.error);
      return;
    }
    refresh();
  }

  async function addMapping() {
    if (!mappingDialog.roleId || !mappingGroup.trim()) return;
    const res = await fetch(`/api/admin/roles/${mappingDialog.roleId}/mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idpGroupName: mappingGroup.trim() }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) { setError(data.error ?? "Failed to add mapping"); return; }
    setMappingGroup("");
    setMappingDialog({ open: false, roleId: null });
    refresh();
  }

  async function deleteMapping(roleId: string, mappingId: string) {
    await fetch(`/api/admin/roles/${roleId}/mappings/${mappingId}`, { method: "DELETE" });
    refresh();
  }

  async function openPolicies(roleId: string, roleName: string) {
    setPolicyPanel({ roleId, roleName });
    setPoliciesLoading(true);
    setPolicyError(null);
    try {
      const [allRes, assignedRes] = await Promise.all([
        fetch("/api/platform/policies"),
        fetch(`/api/admin/roles/${roleId}/policies`),
      ]);
      const allData = await allRes.json() as PlatformPolicy[];
      const assignedData = await assignedRes.json() as { assignedSlugs: string[] };
      setAllPolicies(allData);
      setAssignedSlugs(assignedData.assignedSlugs);
    } catch {
      setPolicyError("Failed to load policies");
    } finally {
      setPoliciesLoading(false);
    }
  }

  async function savePolicies() {
    if (!policyPanel) return;
    setPoliciesSaving(true);
    setPolicyError(null);
    try {
      const res = await fetch(`/api/admin/roles/${policyPanel.roleId}/policies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policySlugs: assignedSlugs }),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        setPolicyError(data.error ?? "Failed to save");
        return;
      }
      setPolicyPanel(null);
    } finally {
      setPoliciesSaving(false);
    }
  }

  function togglePolicy(slug: string) {
    setAssignedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Manager</h1>
          <p className="text-muted-foreground">Manage roles and IDP group mappings</p>
        </div>
        <Button onClick={openNewRole} disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" /> New Role
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>IDP Mappings</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRoles.map((role) => {
              const roleMappings = initialMappings.filter((m) => m.roleId === role.id);
              return (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    {role.displayName}
                    {role.isSystem && <Badge variant="secondary" className="ml-2 text-xs">system</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{role.slug}</TableCell>
                  <TableCell>{role.userCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {roleMappings.map((m) => (
                        <Badge key={m.id} variant="outline" className="flex items-center gap-1 text-xs">
                          {m.idpGroupName}
                          <button
                            onClick={() => deleteMapping(role.id, m.id)}
                            className="ml-1 text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 text-xs"
                        onClick={() => { setMappingGroup(""); setMappingDialog({ open: true, roleId: role.id }); }}
                      >
                        + Map Group
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPolicies(role.id, role.displayName)}
                      >
                        Policies
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditRole(role)} disabled={role.isSystem}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteRole(role.id)} disabled={role.isSystem || isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={roleDialog.open} onOpenChange={(o) => setRoleDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roleDialog.editing ? "Edit Role" : "New Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!roleDialog.editing && (
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input
                  value={roleForm.slug}
                  onChange={(e) => setRoleForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="finance_manager"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Display Name</Label>
              <Input
                value={roleForm.displayName}
                onChange={(e) => setRoleForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={saveRole} disabled={!roleForm.displayName || isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mappingDialog.open} onOpenChange={(o) => setMappingDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add IDP Group Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>IDP Group Name</Label>
            <Input value={mappingGroup} onChange={(e) => setMappingGroup(e.target.value)} placeholder="Corp-Admins" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialog({ open: false, roleId: null })}>Cancel</Button>
            <Button onClick={addMapping} disabled={!mappingGroup.trim() || isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!policyPanel} onOpenChange={(open) => !open && setPolicyPanel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Policies — {policyPanel?.roleName}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-80 overflow-y-auto">
            {policiesLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!policiesLoading && allPolicies.length === 0 && (
              <p className="text-sm text-muted-foreground">No policies defined yet.</p>
            )}
            {allPolicies.map((p) => (
              <label key={p.slug} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={assignedSlugs.includes(p.slug)}
                  onChange={() => togglePolicy(p.slug)}
                />
                <div>
                  <p className="text-sm font-medium">{p.displayName}</p>
                  <p className="text-xs font-mono text-muted-foreground">{p.slug}</p>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
              </label>
            ))}
          </div>
          {policyError && <p className="text-sm text-destructive">{policyError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyPanel(null)}>Cancel</Button>
            <Button onClick={savePolicies} disabled={policiesSaving || policiesLoading}>
              {policiesSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
