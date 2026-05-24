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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronUp, ChevronDown, Plus, Pencil, Trash2, Folder } from "lucide-react";
import { ICON_OPTIONS, ICON_MAP } from "@/lib/icon-map";

interface Section {
  id: string;
  label: string;
  icon: string | null;
  sortOrder: number;
}

interface Item {
  id: string;
  sectionId: string;
  parentItemId: string | null;
  isFolder: boolean;
  label: string;
  route: string;
  icon: string | null;
  badge: string | null;
  requiredRoles: string[];
  requiredSubLevel: number;
  sortOrder: number;
}

interface Role {
  slug: string;
  displayName: string;
}

interface Tier {
  id: string;
  slug: string;
  displayName: string;
  level: number;
}

interface Props {
  sections: Section[];
  items: Item[];
  allRoles: Role[];
  allTiers: Tier[];
}

type SectionForm = { label: string; icon: string };
type ItemForm = {
  sectionId: string;
  parentItemId: string;
  isFolder: boolean;
  label: string;
  route: string;
  icon: string;
  requiredRoles: string[];
  requiredSubLevel: string;
};

const emptySectionForm: SectionForm = { label: "", icon: "" };
const emptyItemForm: ItemForm = {
  sectionId: "",
  parentItemId: "",
  isFolder: false,
  label: "",
  route: "",
  icon: "",
  requiredRoles: [],
  requiredSubLevel: "none",
};

export function MenuManagerClient({ sections: initialSections, items: initialItems, allRoles, allTiers }: Props) {
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
  const [iconSearch, setIconSearch] = useState("");
  const [sectionIconSearch, setSectionIconSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  function openNewSection() {
    setSectionForm(emptySectionForm);
    setSectionIconSearch("");
    setSectionDialog({ open: true, editing: null });
  }

  function openEditSection(s: Section) {
    setSectionForm({ label: s.label, icon: s.icon ?? "" });
    setSectionIconSearch("");
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
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to update section"); return; }
    } else {
      const res = await fetch("/api/admin/menu/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create section"); return; }
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

  function openNewItem(sectionId: string, parentItemId?: string) {
    setItemForm({ ...emptyItemForm, sectionId, parentItemId: parentItemId ?? "" });
    setIconSearch("");
    setItemDialog({ open: true, editing: null });
  }

  function openEditItem(item: Item) {
    setItemForm({
      sectionId: item.sectionId,
      parentItemId: item.parentItemId ?? "",
      isFolder: item.isFolder,
      label: item.label,
      route: item.route,
      icon: item.icon ?? "",
      requiredRoles: item.requiredRoles,
      requiredSubLevel: item.requiredSubLevel > 0 ? String(item.requiredSubLevel) : "none",
    });
    setIconSearch("");
    setItemDialog({ open: true, editing: item });
  }

  function toggleRole(slug: string) {
    setItemForm((f) => ({
      ...f,
      requiredRoles: f.requiredRoles.includes(slug)
        ? f.requiredRoles.filter((r) => r !== slug)
        : [...f.requiredRoles, slug],
    }));
  }

  async function saveItem() {
    setError(null);
    const { editing } = itemDialog;
    const payload = {
      sectionId: itemForm.sectionId,
      parentItemId: itemForm.parentItemId || null,
      isFolder: itemForm.isFolder,
      label: itemForm.label,
      route: itemForm.isFolder ? "" : itemForm.route,
      icon: itemForm.icon || undefined,
      requiredRoles: itemForm.requiredRoles,
      requiredSubLevel: itemForm.requiredSubLevel === "none" ? 0 : Number(itemForm.requiredSubLevel),
    };

    if (editing) {
      const res = await fetch(`/api/admin/menu/items/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to update item"); return; }
    } else {
      const res = await fetch("/api/admin/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create item"); return; }
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
    const sectionItems = initialItems.filter(
      (i) => i.sectionId === item.sectionId && (i.parentItemId ?? null) === (item.parentItemId ?? null)
    );
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

  const filteredIcons = ICON_OPTIONS.filter((name) =>
    name.toLowerCase().includes(iconSearch.toLowerCase())
  );
  const filteredSectionIcons = ICON_OPTIONS.filter((name) =>
    name.toLowerCase().includes(sectionIconSearch.toLowerCase())
  );

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
                {(() => {
                  const topLevelItems = sectionItems.filter((i) => !i.parentItemId);
                  return topLevelItems.map((item, iIdx) => {
                    const children = sectionItems.filter((i) => i.parentItemId === item.id);
                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex items-center justify-between rounded border p-2">
                          <div className="flex items-center gap-2">
                            {item.isFolder && <Folder className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                            <span className="text-sm font-medium">{item.label}</span>
                            {!item.isFolder && <span className="text-xs text-muted-foreground">{item.route}</span>}
                            {item.requiredRoles.map((r) => (
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
                            <Button variant="ghost" size="icon" disabled={iIdx === topLevelItems.length - 1 || isPending} onClick={() => reorderItem(item, "down")}>
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
                        {item.isFolder && (
                          <div className="ml-6 space-y-1 border-l pl-3">
                            {children.map((child, cIdx) => (
                              <div key={child.id} className="flex items-center justify-between rounded border p-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{child.label}</span>
                                  <span className="text-xs text-muted-foreground">{child.route}</span>
                                  {child.requiredRoles.map((r) => (
                                    <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                                  ))}
                                  {child.requiredSubLevel > 0 && (
                                    <Badge variant="secondary" className="text-xs">L{child.requiredSubLevel}+</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" disabled={cIdx === 0 || isPending} onClick={() => reorderItem(child, "up")}>
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" disabled={cIdx === children.length - 1 || isPending} onClick={() => reorderItem(child, "down")}>
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openEditItem(child)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteItem(child.id)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => openNewItem(section.id, item.id)} disabled={isPending}>
                              <Plus className="mr-1 h-3 w-3" /> Add Child Item
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className="flex items-center gap-2">
                      {sectionForm.icon && ICON_MAP[sectionForm.icon] ? (
                        <>
                          {(() => { const Icon = ICON_MAP[sectionForm.icon]; return Icon ? <Icon className="h-4 w-4" /> : null; })()}
                          <span>{sectionForm.icon}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No icon</span>
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 p-2" align="start">
                  <Input
                    placeholder="Search icons..."
                    value={sectionIconSearch}
                    onChange={(e) => setSectionIconSearch(e.target.value)}
                    className="mb-2 h-8"
                  />
                  <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                    {filteredSectionIcons.map((name) => {
                      const Icon = ICON_MAP[name];
                      if (!Icon) return null;
                      return (
                        <button
                          type="button"
                          key={name}
                          title={name}
                          onClick={() => setSectionForm((f) => ({ ...f, icon: name }))}
                          className={`flex flex-col items-center gap-0.5 rounded p-1.5 text-xs transition-colors hover:bg-accent ${sectionForm.icon === name ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="truncate w-full text-center" style={{ fontSize: "9px" }}>{name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {sectionForm.icon && (
                    <button
                      type="button"
                      className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground text-center"
                      onClick={() => setSectionForm((f) => ({ ...f, icon: "" }))}
                    >
                      Clear selection
                    </button>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{itemDialog.editing ? "Edit Item" : "New Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!itemForm.parentItemId && (
              <div className="space-y-1">
                <Label>Type</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setItemForm((f) => ({ ...f, isFolder: false }))}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${!itemForm.isFolder ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemForm((f) => ({ ...f, isFolder: true }))}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${itemForm.isFolder ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}
                  >
                    Folder
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Label</Label>
              <Input value={itemForm.label} onChange={(e) => setItemForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            {!itemForm.isFolder && (
              <div className="space-y-1">
                <Label>Route</Label>
                <Input value={itemForm.route} onChange={(e) => setItemForm((f) => ({ ...f, route: e.target.value }))} placeholder="/dashboard" />
              </div>
            )}

            {/* Icon picker */}
            <div className="space-y-1">
              <Label>Icon (optional)</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className="flex items-center gap-2">
                      {itemForm.icon && ICON_MAP[itemForm.icon] ? (
                        <>
                          {(() => { const Icon = ICON_MAP[itemForm.icon]; return Icon ? <Icon className="h-4 w-4" /> : null; })()}
                          <span>{itemForm.icon}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No icon</span>
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 p-2" align="start">
                  <Input
                    placeholder="Search icons..."
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    className="mb-2 h-8"
                  />
                  <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                    {filteredIcons.map((name) => {
                      const Icon = ICON_MAP[name];
                      if (!Icon) return null;
                      return (
                        <button
                          type="button"
                          key={name}
                          title={name}
                          onClick={() => setItemForm((f) => ({ ...f, icon: name }))}
                          className={`flex flex-col items-center gap-0.5 rounded p-1.5 text-xs transition-colors hover:bg-accent ${itemForm.icon === name ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="truncate w-full text-center" style={{ fontSize: "9px" }}>{name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {itemForm.icon && (
                    <button
                      type="button"
                      className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground text-center"
                      onClick={() => setItemForm((f) => ({ ...f, icon: "" }))}
                    >
                      Clear selection
                    </button>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Required Roles */}
            <div className="space-y-2">
              <Label>Required Roles</Label>
              {allRoles.length === 0 ? (
                <p className="text-xs text-muted-foreground">No roles defined</p>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <span className="flex flex-wrap gap-1 flex-1 text-left">
                        {itemForm.requiredRoles.length === 0 ? (
                          <span className="text-muted-foreground">No restriction</span>
                        ) : (
                          itemForm.requiredRoles.map((slug) => {
                            const role = allRoles.find((r) => r.slug === slug);
                            return (
                              <Badge key={slug} variant="secondary" className="text-xs">
                                {role?.displayName ?? slug}
                              </Badge>
                            );
                          })
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full min-w-[200px]">
                    {allRoles.map((role) => (
                      <DropdownMenuCheckboxItem
                        key={role.slug}
                        checked={itemForm.requiredRoles.includes(role.slug)}
                        onCheckedChange={() => toggleRole(role.slug)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {role.displayName}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Required Subscription Level */}
            <div className="space-y-1">
              <Label>Required Subscription</Label>
              <Select value={itemForm.requiredSubLevel} onValueChange={(v) => setItemForm((f) => ({ ...f, requiredSubLevel: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="No restriction" />
                </SelectTrigger>
                <SelectContent>
                  {allTiers.map((tier) => (
                    <SelectItem key={tier.id} value={String(tier.level)}>
                      {tier.displayName} (L{tier.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={saveItem} disabled={!itemForm.label || (!itemForm.isFolder && !itemForm.route) || isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
