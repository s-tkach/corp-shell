"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Plus, Pencil, Trash2 } from "lucide-react";

interface Section {
  id: string;
  label: string;
  icon: string | null;
  sortOrder: number;
}

interface Item {
  id: string;
  sectionId: string;
  label: string;
  route: string;
  icon: string | null;
  badge: string | null;
  requiredRoles: unknown;
  requiredSubLevel: number;
  sortOrder: number;
}

interface Role {
  slug: string;
  displayName: string;
}

interface Props {
  sections: Section[];
  items: Item[];
  allRoles: Role[];
}

type SectionForm = { label: string; icon: string };
type ItemForm = {
  sectionId: string;
  label: string;
  route: string;
  icon: string;
  requiredRoles: string;
  requiredSubLevel: string;
};

const emptySectionForm: SectionForm = { label: "", icon: "" };
const emptyItemForm: ItemForm = {
  sectionId: "",
  label: "",
  route: "",
  icon: "",
  requiredRoles: "",
  requiredSubLevel: "0",
};

export function MenuManagerClient({ sections: initialSections, items: initialItems, allRoles }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; editing: Section | null }>({
    open: false,
    editing: null,
  });
  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySectionForm);

  const [itemDialog, setItemDialog] = useState<{ open: boolean; editing: Item | null }>({
    open: false,
    editing: null,
  });
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  function openNewSection() {
    setSectionForm(emptySectionForm);
    setSectionDialog({ open: true, editing: null });
  }

  function openEditSection(s: Section) {
    setSectionForm({ label: s.label, icon: s.icon ?? "" });
    setSectionDialog({ open: true, editing: s });
  }

  async function saveSection() {
    setError(null);
    const { editing } = sectionDialog;
    const payload = { label: sectionForm.label, icon: sectionForm.icon || undefined };

    if (editing) {
      const res = await fetch(`/api/admin/menu/sections/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError("Failed to update section"); return; }
    } else {
      const res = await fetch("/api/admin/menu/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError("Failed to create section"); return; }
    }
    setSectionDialog({ open: false, editing: null });
    refresh();
  }

  async function deleteSection(id: string) {
    if (!confirm("Delete this section and all its items?")) return;
    await fetch(`/api/admin/menu/sections/${id}`, { method: "DELETE" });
    refresh();
  }

  async function reorderSection(section: Section, direction: "up" | "down") {
    const idx = initialSections.findIndex((s) => s.id === section.id);
    const swap = direction === "up" ? initialSections[idx - 1] : initialSections[idx + 1];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/admin/menu/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      fetch(`/api/admin/menu/sections/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: section.sortOrder }),
      }),
    ]);
    refresh();
  }

  function openNewItem(sectionId: string) {
    setItemForm({ ...emptyItemForm, sectionId });
    setItemDialog({ open: true, editing: null });
  }

  function openEditItem(item: Item) {
    setItemForm({
      sectionId: item.sectionId,
      label: item.label,
      route: item.route,
      icon: item.icon ?? "",
      requiredRoles: (item.requiredRoles as string[]).join(", "),
      requiredSubLevel: String(item.requiredSubLevel),
    });
    setItemDialog({ open: true, editing: item });
  }

  async function saveItem() {
    setError(null);
    const { editing } = itemDialog;
    const payload = {
      sectionId: itemForm.sectionId,
      label: itemForm.label,
      route: itemForm.route,
      icon: itemForm.icon || undefined,
      requiredRoles: itemForm.requiredRoles
        ? itemForm.requiredRoles.split(",").map((r) => r.trim()).filter(Boolean)
        : [],
      requiredSubLevel: Number(itemForm.requiredSubLevel),
    };

    if (editing) {
      const res = await fetch(`/api/admin/menu/items/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError("Failed to update item"); return; }
    } else {
      const res = await fetch("/api/admin/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError("Failed to create item"); return; }
    }
    setItemDialog({ open: false, editing: null });
    refresh();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this menu item?")) return;
    await fetch(`/api/admin/menu/items/${id}`, { method: "DELETE" });
    refresh();
  }

  async function reorderItem(item: Item, direction: "up" | "down") {
    const sectionItems = initialItems.filter((i) => i.sectionId === item.sectionId);
    const idx = sectionItems.findIndex((i) => i.id === item.id);
    const swap = direction === "up" ? sectionItems[idx - 1] : sectionItems[idx + 1];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/admin/menu/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      fetch(`/api/admin/menu/items/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: item.sortOrder }),
      }),
    ]);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu Manager</h1>
          <p className="text-muted-foreground">Manage navigation sections and items</p>
        </div>
        <Button onClick={openNewSection} disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" /> New Section
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-4">
        {initialSections.map((section, sIdx) => {
          const sectionItems = initialItems.filter((i) => i.sectionId === section.id);
          return (
            <Card key={section.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {section.icon && <span className="mr-2 text-muted-foreground">{section.icon}</span>}
                    {section.label}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled={sIdx === 0 || isPending} onClick={() => reorderSection(section, "up")}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={sIdx === initialSections.length - 1 || isPending} onClick={() => reorderSection(section, "down")}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditSection(section)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteSection(section.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {sectionItems.map((item, iIdx) => (
                  <div key={item.id} className="flex items-center justify-between rounded border p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.route}</span>
                      {(item.requiredRoles as string[]).map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                      ))}
                      {item.requiredSubLevel > 0 && (
                        <Badge variant="secondary" className="text-xs">L{item.requiredSubLevel}+</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" disabled={iIdx === 0 || isPending} onClick={() => reorderItem(item, "up")}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={iIdx === sectionItems.length - 1 || isPending} onClick={() => reorderItem(item, "down")}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditItem(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => openNewItem(section.id)} disabled={isPending}>
                  <Plus className="mr-1 h-3 w-3" /> Add Item
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Section dialog */}
      <Dialog open={sectionDialog.open} onOpenChange={(o) => setSectionDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sectionDialog.editing ? "Edit Section" : "New Section"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Label</Label>
              <Input value={sectionForm.label} onChange={(e) => setSectionForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Icon (optional)</Label>
              <Input value={sectionForm.icon} onChange={(e) => setSectionForm((f) => ({ ...f, icon: e.target.value }))} placeholder="e.g. LayoutDashboard" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={saveSection} disabled={!sectionForm.label || isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item dialog */}
      <Dialog open={itemDialog.open} onOpenChange={(o) => setItemDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemDialog.editing ? "Edit Item" : "New Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Label</Label>
              <Input value={itemForm.label} onChange={(e) => setItemForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Route</Label>
              <Input value={itemForm.route} onChange={(e) => setItemForm((f) => ({ ...f, route: e.target.value }))} placeholder="/dashboard" />
            </div>
            <div className="space-y-1">
              <Label>Icon (optional)</Label>
              <Input value={itemForm.icon} onChange={(e) => setItemForm((f) => ({ ...f, icon: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Required Roles (comma-separated)</Label>
              <Input
                value={itemForm.requiredRoles}
                onChange={(e) => setItemForm((f) => ({ ...f, requiredRoles: e.target.value }))}
                placeholder={allRoles.map((r) => r.slug).join(", ")}
              />
            </div>
            <div className="space-y-1">
              <Label>Required Subscription Level</Label>
              <Input
                type="number"
                min={0}
                value={itemForm.requiredSubLevel}
                onChange={(e) => setItemForm((f) => ({ ...f, requiredSubLevel: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={saveItem} disabled={!itemForm.label || !itemForm.route || isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
