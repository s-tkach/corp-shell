import { signIn } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";
import { unstable_cacheTag as cacheTag } from "next/cache";

async function getLoginConfig() {
  "use cache";
  cacheTag("shell-config");
  const rows = await db
    .select({
      appName: shellConfig.appName,
      logoUrl: shellConfig.logoUrl,
      loginBgImageUrl: shellConfig.loginBgImageUrl,
      loginBgColor: shellConfig.loginBgColor,
      loginHeadline: shellConfig.loginHeadline,
      loginFormPosition: shellConfig.loginFormPosition,
      loginCardColor: shellConfig.loginCardColor,
      loginButtonColor: shellConfig.loginButtonColor,
      loginButtonText: shellConfig.loginButtonText,
    })
    .from(shellConfig)
    .limit(1);
  return rows[0] ?? null;
}

export default async function LoginPage(props: { searchParams: Promise<Record<string, string>> }) {
  const [config, searchParams] = await Promise.all([getLoginConfig(), props.searchParams]);

  const bgImage = config?.loginBgImageUrl;
  const bgColor = config?.loginBgColor ?? "#0f172a";
  const headline = config?.loginHeadline ?? "";
  const position = (config?.loginFormPosition ?? "center") as "left" | "center" | "right";
  const appName = config?.appName ?? "Corp Shell";
  const logoUrl = config?.logoUrl;
  const cardColor = config?.loginCardColor ?? "#ffffff";
  const buttonColor = config?.loginButtonColor ?? "#0f172a";
  const buttonText = config?.loginButtonText || "Sign in with SSO";

  const callbackUrl = searchParams["callbackUrl"] ?? "/";

  const justifyClass =
    position === "left" ? "justify-start" : position === "right" ? "justify-end" : "justify-center";

  async function handleSignIn() {
    "use server";
    await signIn("oidc", { redirectTo: callbackUrl });
  }

  return (
    <div
      className={`min-h-screen flex items-center ${justifyClass} relative`}
      style={{
        backgroundColor: bgColor,
        ...(bgImage
          ? {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
      }}
    >
      {bgImage && <div className="absolute inset-0 bg-black/40" />}

      <div className="relative z-10 w-full max-w-sm mx-6 rounded-2xl backdrop-blur-sm shadow-2xl p-8 flex flex-col gap-6" style={{ backgroundColor: cardColor }}>
        {/* Logo + app name */}
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={appName} className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              {appName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-lg font-semibold text-foreground">{appName}</span>
        </div>

        {/* Headline */}
        {headline && (
          <div>
            <p className="text-2xl font-bold text-foreground leading-tight">{headline}</p>
          </div>
        )}

        {/* Sign-in form */}
        <form action={handleSignIn}>
          <button
            type="submit"
            className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: buttonColor }}
          >
            {buttonText}
          </button>
        </form>
      </div>
    </div>
  );
}
