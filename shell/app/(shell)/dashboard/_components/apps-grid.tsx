import Link from "next/link";
import type { MenuItem } from "@/app/api/menu/route";

interface AppsGridProps {
  items: MenuItem[];
}

function AppCard({ item }: { item: MenuItem }) {
  return (
    <Link
      href={item.route}
      aria-label={item.label}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-center transition-colors hover:bg-muted"
    >
      {item.icon ? (
        <span className="text-2xl" aria-hidden={true}>
          {item.icon}
        </span>
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {item.label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-xs font-medium leading-tight">{item.label}</span>
    </Link>
  );
}

export function AppsGrid({ items }: AppsGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No apps available yet.</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <AppCard key={item.id} item={item} />
      ))}
    </div>
  );
}
