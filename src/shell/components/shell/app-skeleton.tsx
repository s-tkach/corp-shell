export function AppSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-48 w-full rounded bg-muted" />
    </div>
  );
}
