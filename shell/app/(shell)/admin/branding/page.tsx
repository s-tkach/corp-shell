import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";
import { BrandingClient } from "./branding-client";

export default async function BrandingPage() {
  const rows = await db.select().from(shellConfig).limit(1);
  const config = rows[0] ?? null;
  return <BrandingClient config={config} />;
}
