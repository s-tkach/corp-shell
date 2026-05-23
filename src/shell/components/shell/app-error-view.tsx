import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppErrorViewProps {
  error?: Error;
  reset?: () => void;
}

export function AppErrorView({ error, reset }: AppErrorViewProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div>
        <h2 className="text-lg font-semibold">Failed to load application</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error?.message ?? "An unexpected error occurred while loading the child app."}
        </p>
      </div>
      {reset && (
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
      )}
    </div>
  );
}
