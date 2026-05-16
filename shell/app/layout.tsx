import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { CloudWatchRum } from "@/components/shell/cloudwatch-rum";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Corp Shell",
  description: "Corporate Application Shell",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const theme =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";

  const rumAppId = process.env.CLOUDWATCH_RUM_APP_ID;
  const rumIdentityPoolId = process.env.CLOUDWATCH_RUM_IDENTITY_POOL_ID;
  const rumRegion = process.env.CLOUDWATCH_RUM_REGION ?? "us-east-1";
  const rumEndpoint = process.env.CLOUDWATCH_RUM_ENDPOINT ?? "https://dataplane.rum.us-east-1.amazonaws.com";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full">
        {rumAppId && rumIdentityPoolId && (
          <CloudWatchRum
            appId={rumAppId}
            identityPoolId={rumIdentityPoolId}
            region={rumRegion}
            endpoint={rumEndpoint}
          />
        )}
        <ThemeProvider
          attribute="class"
          defaultTheme={theme}
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
