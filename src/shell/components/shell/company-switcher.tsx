"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface Company {
  id: string;
  parentId: string | null;
  name: string;
  logoUrl: string | null;
  depth: number;
}

interface Props {
  companies: Company[];
  activeCompanyId: string | null;
}

export function CompanySwitcher({ companies, activeCompanyId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  if (companies.length === 0) return null;

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;

  const filtered = search.trim()
    ? companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : companies;

  async function switchTo(companyId: string) {
    startTransition(async () => {
      await fetch("/api/users/me/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      router.refresh();
    });
  }

  const avatar = activeCompany ? (
    activeCompany.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={activeCompany.logoUrl} alt="" className="h-8 w-8 rounded-full object-contain flex-shrink-0" />
    ) : (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {activeCompany.name.charAt(0).toUpperCase()}
      </span>
    )
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
      <Building2 className="h-4 w-4 text-muted-foreground" />
    </span>
  );

  if (companies.length === 1 && activeCompany) {
    return (
      <div className="flex w-full items-center gap-3 rounded-md px-3 py-2">
        {avatar}
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate text-sm font-medium text-sidebar-foreground">{activeCompany.name}</span>
          <span className="truncate text-xs text-sidebar-foreground/60">Company</span>
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Switch company"
          disabled={isPending}
          className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {avatar}
          <span className="flex min-w-0 flex-1 flex-col text-left">
            <span className="truncate text-sm font-medium text-sidebar-foreground">{activeCompany?.name ?? "Select company"}</span>
            <span className="truncate text-xs text-sidebar-foreground/60">Company</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {companies.length > 8 && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies…"
                className="h-7 pl-7 text-xs"
                autoFocus
              />
            </div>
          </div>
        )}
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => switchTo(company.id)}
              className="flex items-center gap-2"
              style={{ paddingLeft: `${company.depth * 16 + 8}px` }}
            >
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt="" className="h-4 w-4 rounded object-contain flex-shrink-0" />
              ) : (
                <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate text-sm">{company.name}</span>
              {company.id === activeCompanyId && (
                <Check className="h-3 w-3 flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          {filtered.length === 0 && (
            <p className="p-3 text-center text-xs text-muted-foreground">No companies found</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
