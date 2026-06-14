"use client";

import { useEffect, useState, useTransition } from "react";
import { useNotifications } from "@/components/shell/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Folder, Pencil } from "lucide-react";

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
  sortOrder: number;
  requiredRoleIds: string[];
  requiredRoles: string[];
  requiredRoleLabels: string[];
}

interface Role {
  id: string;
  slug: string;
  displayName: string;
}

interface MenuResponse {
  currentTier: {
    slug: string;
    level: number;
  };
  sections: Section[];
  items: Item[];
}

export function MenuManagerClient() {
  const { showToast } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [currentTier, setCurrentTier] = useState<MenuResponse["currentTier"] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; item: Item | null }>({
    open: false,
    item: null,
  });
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  async function loadData() {
    const [menuRes, rolesRes] = await Promise.all([
      fetch("/api/settings/menu"),
      fetch("/api/settings/roles"),
    ]);

    if (!menuRes.ok || !rolesRes.ok) {
      showToast({ title: "Failed to load tenant menu data", variant: "error" });
      return;
    }

    const [menuData, roleData] = await Promise.all([
      menuRes.json() as Promise<MenuResponse>,
      rolesRes.json() as Promise<Role[]>,
    ]);

    setCurrentTier(menuData.currentTier);
    setSections(menuData.sections);
    setItems(menuData.items);
    setRoles(roleData);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function refresh() {
    startTransition(() => {
      void loadData();
    });
  }

  function openRoleEditor(item: Item) {
    setSelectedRoleIds(item.requiredRoleIds);
    setDialog({ open: true, item });
  }

  async function saveRoles() {
    if (!dialog.item) return;

    const res = await fetch(`/api/settings/menu/${dialog.item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requiredRoleIds: selectedRoleIds }),
    });

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      showToast({ title: data.error ?? "Failed to save roles", variant: "error" });
      return;
    }

    setDialog({ open: false, item: null });
    refresh();
  }

  function renderItem(item: Item) {
    const children = items
      .filter((candidate) => candidate.parentItemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

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
            {item.requiredRoleLabels.map((label) => (
              <Badge key={label} variant="outline" className="text-xs">
                {label}
              </Badge>
            ))}
            {item.requiredRoleLabels.length === 0 && (
              <span className="text-xs text-muted-foreground">
                Visible to all authenticated users
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => openRoleEditor(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        {item.isFolder && children.length > 0 && (
          <div className="ml-6 space-y-1 border-l pl-3">
            {children.map((child) => renderItem(child))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tenant Menu Roles</h1>
        <p className="text-muted-foreground">
          Hide shared menu items for this tenant by assigning required roles.
        </p>
      </div>

      {currentTier && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Badge variant="secondary">Current Tier</Badge>
            <span className="text-sm font-medium">
              {currentTier.slug} (L{currentTier.level})
            </span>
            <span className="text-sm text-muted-foreground">
              All lower-tier menu items are included automatically.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {sections.map((section) => {
          const topLevelItems = items
            .filter((item) => item.sectionId === section.id && item.parentItemId === null)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          if (topLevelItems.length === 0) {
            return null;
          }

          return (
            <Card key={section.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{section.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topLevelItems.map((item) => renderItem(item))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.item ? `Required Roles: ${dialog.item.label}` : "Required Roles"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If no roles are selected, the item is visible to all authenticated users in this tenant.
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const selected = selectedRoleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoleIds((current) =>
                        selected
                          ? current.filter((id) => id !== role.id)
                          : [...current, role.id]
                      );
                    }}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {role.displayName}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, item: null })}>
              Cancel
            </Button>
            <Button onClick={() => void saveRoles()} disabled={isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
