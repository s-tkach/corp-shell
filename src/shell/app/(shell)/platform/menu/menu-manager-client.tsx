"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useNotifications } from "@/components/shell/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Folder, Pencil, Plus, Trash2 } from "lucide-react";

interface Tier {
  id: string;
  slug: string;
  displayName: string;
  level: number;
}

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
  subscriptionTierId: string | null;
  subscriptionTierLabel: string | null;
  isInherited: boolean;
  sortOrder: number;
}

interface Props {
  allTiers: Tier[];
}

type ScopeValue = string;

type SectionForm = {
  label: string;
  icon: string;
};

type ItemForm = {
  sectionId: string;
  parentItemId: string;
  isFolder: boolean;
  label: string;
  route: string;
  icon: string;
  badge: string;
  subscriptionScope: string;
};

const PLATFORM_SCOPE = "platform";
const emptySectionForm: SectionForm = { label: "", icon: "" };
const emptyItemForm: ItemForm = {
  sectionId: "",
  parentItemId: "",
  isFolder: false,
  label: "",
  route: "",
  icon: "",
  badge: "",
  subscriptionScope: PLATFORM_SCOPE,
};

function buildItemsQuery(selectedScope: ScopeValue): string {
  if (selectedScope === PLATFORM_SCOPE) {
    return "/api/platform/menu/items?scope=platform";
  }
  return `/api/platform/menu/items?tierId=${selectedScope}`;
}

export function MenuManagerClient({ allTiers }: Props) {
  const { showToast } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [selectedScope, setSelectedScope] = useState<ScopeValue>(allTiers[0]?.id ?? PLATFORM_SCOPE);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; editing: Section | null }>({
    open: false,
    editing: null,
  });
  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySectionForm);

  const [itemDialog, setItemDialog] = useState<{ open: boolean; editing: Item | null }>({
    open: false,
    editing: null,
  });
  const [itemForm, setItemForm] = useState<ItemForm>({
    ...emptyItemForm,
    subscriptionScope: allTiers[0]?.id ?? PLATFORM_SCOPE,
  });

  const scopeLabel = useMemo(() => {
    if (selectedScope === PLATFORM_SCOPE) return "Platform-only items";
    return allTiers.find((tier) => tier.id === selectedScope)?.displayName ?? "Selected tier";
  }, [allTiers, selectedScope]);

  async function loadScopeData(scope: ScopeValue) {
    const [sectionsRes, itemsRes] = await Promise.all([
      fetch("/api/platform/menu/sections"),
      fetch(buildItemsQuery(scope)),
    ]);

    if (!sectionsRes.ok || !itemsRes.ok) {
      showToast({ title: "Failed to load menu data", variant: "error" });
      setSections([]);
      setItems([]);
      return;
    }

    const [sectionsData, itemsData] = await Promise.all([
      sectionsRes.json() as Promise<Section[]>,
      itemsRes.json() as Promise<Item[]>,
    ]);
    setSections(sectionsData);
    setItems(itemsData);
  }

  useEffect(() => {
    void loadScopeData(selectedScope);
  }, [selectedScope]);

  function refresh() {
    startTransition(() => {
      void loadScopeData(selectedScope);
    });
  }

  function openNewSection() {
    setSectionForm(emptySectionForm);
    setSectionDialog({ open: true, editing: null });
  }

  function openEditSection(section: Section) {
    setSectionForm({ label: section.label, icon: section.icon ?? "" });
    setSectionDialog({ open: true, editing: section });
  }

  async function saveSection() {
    const payload = {
      label: sectionForm.label.trim(),
      icon: sectionForm.icon.trim() || undefined,
    };

    if (sectionDialog.editing) {
      const res = await fetch(`/api/platform/menu/sections/${sectionDialog.editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        showToast({ title: data.error ?? "Failed to update section", variant: "error" });
        return;
      }
    } else {
      const res = await fetch("/api/platform/menu/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        showToast({ title: data.error ?? "Failed to create section", variant: "error" });
        return;
      }
    }

    setSectionDialog({ open: false, editing: null });
    refresh();
  }

  async function deleteSection(sectionId: string) {
    if (!confirm("Delete this section and all its items?")) return;
    await fetch(`/api/platform/menu/sections/${sectionId}`, { method: "DELETE" });
    refresh();
  }

  async function reorderSection(section: Section, direction: "up" | "down") {
    const idx = sections.findIndex((candidate) => candidate.id === section.id);
    const swap = direction === "up" ? sections[idx - 1] : sections[idx + 1];
    if (!swap) return;

    await Promise.all([
      fetch(`/api/platform/menu/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      fetch(`/api/platform/menu/sections/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: section.sortOrder }),
      }),
    ]);

    refresh();
  }

  function openNewItem(sectionId: string, parentItemId?: string) {
    setItemForm({
      ...emptyItemForm,
      sectionId,
      parentItemId: parentItemId ?? "",
      subscriptionScope: selectedScope,
    });
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
      badge: item.badge ?? "",
      subscriptionScope: item.subscriptionTierId ?? PLATFORM_SCOPE,
    });
    setItemDialog({ open: true, editing: item });
  }

  async function saveItem() {
    const payload = {
      sectionId: itemForm.sectionId,
      parentItemId: itemForm.parentItemId || null,
      isFolder: itemForm.isFolder,
      label: itemForm.label.trim(),
      route: itemForm.isFolder ? "" : itemForm.route.trim(),
      icon: itemForm.icon.trim() || undefined,
      badge: itemForm.badge.trim() || undefined,
      subscriptionTierId:
        itemForm.subscriptionScope === PLATFORM_SCOPE ? null : itemForm.subscriptionScope,
    };

    if (itemDialog.editing) {
      const res = await fetch(`/api/platform/menu/items/${itemDialog.editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        showToast({ title: data.error ?? "Failed to update item", variant: "error" });
        return;
      }
    } else {
      const res = await fetch("/api/platform/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        showToast({ title: data.error ?? "Failed to create item", variant: "error" });
        return;
      }
    }

    setItemDialog({ open: false, editing: null });
    refresh();
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Delete this menu item?")) return;
    await fetch(`/api/platform/menu/items/${itemId}`, { method: "DELETE" });
    refresh();
  }

  async function reorderOwnedItem(item: Item, direction: "up" | "down") {
    const siblingItems = items
      .filter((candidate) => candidate.sectionId === item.sectionId)
      .filter((candidate) => (candidate.parentItemId ?? null) === (item.parentItemId ?? null))
      .filter((candidate) => candidate.subscriptionTierId === item.subscriptionTierId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = siblingItems.findIndex((candidate) => candidate.id === item.id);
    const swap = direction === "up" ? siblingItems[idx - 1] : siblingItems[idx + 1];
    if (!swap) return;

    await Promise.all([
      fetch(`/api/platform/menu/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      fetch(`/api/platform/menu/items/${swap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: item.sortOrder }),
      }),
    ]);

    refresh();
  }

  function renderItem(item: Item, index: number, siblings: Item[]) {
    const children = items
      .filter((candidate) => candidate.parentItemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const canMutate = !item.isInherited;

    return (
      <div key={item.id} className="space-y-1">
        <div className="flex items-center justify-between rounded border p-2">
          <div className="flex items-center gap-2">
            {item.isFolder && <Folder className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-sm font-medium">{item.label}</span>
            {!item.isFolder && item.route && (
              <span className="text-xs text-muted-foreground">{item.route}</span>
            )}
            <Badge variant="secondary" className="text-xs">
              {item.subscriptionTierLabel ?? "Platform"}
            </Badge>
            {item.isInherited && (
              <Badge variant="outline" className="text-xs">
                Inherited
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canMutate || index === 0 || isPending}
              onClick={() => void reorderOwnedItem(item, "up")}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canMutate || index === siblings.length - 1 || isPending}
              onClick={() => void reorderOwnedItem(item, "down")}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canMutate}
              onClick={() => openEditItem(item)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canMutate}
              onClick={() => void deleteItem(item.id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>
        {item.isFolder && (
          <div className="ml-6 space-y-1 border-l pl-3">
            {children.map((child, childIndex) =>
              renderItem(child, childIndex, children.filter((candidate) => candidate.subscriptionTierId === child.subscriptionTierId))
            )}
            {!item.isInherited && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openNewItem(item.sectionId, item.id)}
                disabled={isPending}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Child Item
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu Manager</h1>
          <p className="text-muted-foreground">
            Manage shared menu structure by subscription tier and platform-only scope.
          </p>
        </div>
        <Button onClick={openNewSection} disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" /> New Section
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[20rem_1fr]">
        <div className="space-y-2">
          <Label>Scope</Label>
          <Select value={selectedScope} onValueChange={setSelectedScope}>
            <SelectTrigger>
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              {allTiers.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  {tier.displayName} (L{tier.level})
                </SelectItem>
              ))}
              <SelectItem value={PLATFORM_SCOPE}>Platform-only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Viewing: {scopeLabel}. Higher tiers preview inherited lower-tier items.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, sectionIndex) => {
          const topLevelItems = items
            .filter((item) => item.sectionId === section.id && item.parentItemId === null)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          return (
            <Card key={section.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{section.label}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={sectionIndex === 0 || isPending}
                      onClick={() => void reorderSection(section, "up")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={sectionIndex === sections.length - 1 || isPending}
                      onClick={() => void reorderSection(section, "down")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditSection(section)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => void deleteSection(section.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {topLevelItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No items in this section for the selected scope.</p>
                )}
                {topLevelItems.map((item, index) => renderItem(item, index, topLevelItems.filter((candidate) => candidate.subscriptionTierId === item.subscriptionTierId)))}
                <Button variant="outline" size="sm" onClick={() => openNewItem(section.id)} disabled={isPending}>
                  <Plus className="mr-1 h-3 w-3" /> Add Item
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={sectionDialog.open} onOpenChange={(open) => setSectionDialog((state) => ({ ...state, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sectionDialog.editing ? "Edit Section" : "New Section"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                value={sectionForm.label}
                onChange={(event) => setSectionForm((state) => ({ ...state, label: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Icon (optional)</Label>
              <Input
                value={sectionForm.icon}
                onChange={(event) => setSectionForm((state) => ({ ...state, icon: event.target.value }))}
                placeholder="Lucide icon name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog({ open: false, editing: null })}>
              Cancel
            </Button>
            <Button onClick={() => void saveSection()} disabled={!sectionForm.label.trim() || isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialog.open} onOpenChange={(open) => setItemDialog((state) => ({ ...state, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemDialog.editing ? "Edit Item" : "New Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!itemForm.parentItemId && (
              <div className="space-y-1">
                <Label>Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={itemForm.isFolder ? "outline" : "default"}
                    onClick={() => setItemForm((state) => ({ ...state, isFolder: false }))}
                    className="flex-1"
                  >
                    Link
                  </Button>
                  <Button
                    type="button"
                    variant={itemForm.isFolder ? "default" : "outline"}
                    onClick={() => setItemForm((state) => ({ ...state, isFolder: true }))}
                    className="flex-1"
                  >
                    Folder
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                value={itemForm.label}
                onChange={(event) => setItemForm((state) => ({ ...state, label: event.target.value }))}
              />
            </div>
            {!itemForm.isFolder && (
              <div className="space-y-1">
                <Label>Route</Label>
                <Input
                  value={itemForm.route}
                  onChange={(event) => setItemForm((state) => ({ ...state, route: event.target.value }))}
                  placeholder="/dashboard"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Icon (optional)</Label>
              <Input
                value={itemForm.icon}
                onChange={(event) => setItemForm((state) => ({ ...state, icon: event.target.value }))}
                placeholder="Lucide icon name"
              />
            </div>
            <div className="space-y-1">
              <Label>Badge (optional)</Label>
              <Input
                value={itemForm.badge}
                onChange={(event) => setItemForm((state) => ({ ...state, badge: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Owning Scope</Label>
              <Select
                value={itemForm.subscriptionScope}
                onValueChange={(value) => setItemForm((state) => ({ ...state, subscriptionScope: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select owning scope" />
                </SelectTrigger>
                <SelectContent>
                  {allTiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.displayName} (L{tier.level})
                    </SelectItem>
                  ))}
                  <SelectItem value={PLATFORM_SCOPE}>Platform-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog({ open: false, editing: null })}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveItem()}
              disabled={!itemForm.label.trim() || (!itemForm.isFolder && !itemForm.route.trim()) || isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
