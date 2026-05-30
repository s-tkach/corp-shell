"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  if (companies.length === 1 && activeCompany) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium px-2">
        {activeCompany.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeCompany.logoUrl} alt="" className="h-4 w-4 rounded object-contain" />
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="max-w-[140px] truncate">{activeCompany.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 gap-1.5 px-2 text-sm font-medium max-w-[200px]"
          disabled={isPending}
        >
          {activeCompany?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeCompany.logoUrl} alt="" className="h-4 w-4 rounded object-contain flex-shrink-0" />
          ) : (
            <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{activeCompany?.name ?? "Select company"}</span>
          <ChevronsUpDown className="h-3 w-3 flex-shrink-0 opacity-50" />
        </Button>
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
