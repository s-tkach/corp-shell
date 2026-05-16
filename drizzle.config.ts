import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./shell/lib/db/schema.ts",
  out: "./shell/lib/db/migrations",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "",
  },
});
