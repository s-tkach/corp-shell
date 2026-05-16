import Link from "next/link";
import type { SearchParams } from "next/dist/server/request/search-params";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthCallbackError:
    "An error occurred during the sign-in callback. Please try again.",
  AccessDenied:
    "You do not have permission to access this application. Contact your administrator.",
  OAuthSignInError:
    "Unable to initiate sign-in with your identity provider. Please try again.",
  SessionTokenError:
    "Your session token is invalid or has expired. Please sign in again.",
  OAuthAccountNotLinked:
    "This account is linked to a different sign-in method.",
  Verification:
    "The sign-in link is invalid or has expired. Please request a new one.",
  Configuration:
    "There is a server configuration error. Contact your administrator.",
  Default: "An unexpected authentication error occurred. Please try again.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const errorCode =
    typeof params["error"] === "string" ? params["error"] : "Default";
  const message = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES["Default"]!;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md rounded-lg border p-8 shadow-sm">
        <h1 className="mb-4 text-2xl font-semibold">Sign-in Error</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <Link
          href="/api/auth/signin"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}
