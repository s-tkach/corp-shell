export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Account Suspended</h1>
        <p className="mt-2 text-muted-foreground">
          This organization has been suspended. Contact support for assistance.
        </p>
      </div>
    </div>
  );
}
