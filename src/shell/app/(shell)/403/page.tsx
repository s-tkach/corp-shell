import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <h1 className="text-4xl font-bold">403</h1>
      <p className="text-xl text-muted-foreground">Access Denied</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        You do not have permission to view this page.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 underline underline-offset-4 text-sm hover:text-primary"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
