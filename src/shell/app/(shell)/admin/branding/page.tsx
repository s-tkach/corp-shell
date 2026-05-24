import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";
import { BrandingClient } from "./branding-client";

export default async function BrandingPage() {
  const rows = await db
    .select({
      id: shellConfig.id,
      appName: shellConfig.appName,
      logoUrl: shellConfig.logoUrl,
      colorOverrides: shellConfig.colorOverrides,
      colorOverridesDark: shellConfig.colorOverridesDark,
      loginBgImageUrl: shellConfig.loginBgImageUrl,
      loginBgColor: shellConfig.loginBgColor,
      loginHeadline: shellConfig.loginHeadline,
      loginFormPosition: shellConfig.loginFormPosition,
      loginCardColor: shellConfig.loginCardColor,
      loginButtonColor: shellConfig.loginButtonColor,
      loginButtonText: shellConfig.loginButtonText,
      headerShowDate: shellConfig.headerShowDate,
      headerDateFormat: shellConfig.headerDateFormat,
      toastPosition: shellConfig.toastPosition,
      toastBgColor: shellConfig.toastBgColor,
      toastTextColor: shellConfig.toastTextColor,
      toastBorderColor: shellConfig.toastBorderColor,
      toastDuration: shellConfig.toastDuration,
    })
    .from(shellConfig)
    .limit(1);
  const config = rows[0] ?? null;
  return <BrandingClient config={config} />;
}
