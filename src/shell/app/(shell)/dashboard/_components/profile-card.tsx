import { Badge } from "@/components/ui/badge";

interface ProfileCardProps {
  name: string;
  email: string;
  roles: string[];
  subscriptionTier: string;
}

export function ProfileCard({
  name,
  email,
  roles,
  subscriptionTier,
}: ProfileCardProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Profile
      </p>
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {roles.map((role) => (
          <Badge key={role} variant="secondary" className="text-xs">
            {role}
          </Badge>
        ))}
        <Badge variant="outline" className="text-xs">
          {subscriptionTier}
        </Badge>
      </div>
    </div>
  );
}
