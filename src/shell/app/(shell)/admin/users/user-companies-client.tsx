"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronRight } from "lucide-react";

interface Company {
  id: string;
  parentId: string | null;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface Props {
  userId: string;
  allCompanies: Company[];
  assignedCompanyIds: string[];
}

function flattenTree(
  companies: Company[],
  parentId: string | null = null,
  depth = 0
): { company: Company; depth: number }[] {
  return companies
    .filter((c) => c.parentId === parentId && c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((c) => [{ company: c, depth }, ...flattenTree(companies, c.id, depth + 1)]);
}

export function UserCompaniesClient({ userId, allCompanies, assignedCompanyIds }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedCompanyIds));
  const [error, setError] = useState<string | null>(null);

  const flat = flattenTree(allCompanies);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/companies`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyIds: Array.from(selected) }),
        });
        if (!res.ok) throw new Error("Failed to save");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "An error occurred");
      }
    });
  }

  if (flat.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No companies configured. Add companies in Admin → Companies first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
        {flat.map(({ company, depth }) => (
          <div
            key={company.id}
            className="flex items-center gap-2 p-2 hover:bg-muted/30"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            {depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            <Checkbox
              id={`company-${company.id}`}
              checked={selected.has(company.id)}
              onCheckedChange={() => toggle(company.id)}
            />
            <Label htmlFor={`company-${company.id}`} className="text-sm cursor-pointer">
              {company.name}
            </Label>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="sm" onClick={handleSave} disabled={isPending}>
        {isPending ? "Saving…" : "Save company access"}
      </Button>
    </div>
  );
}
