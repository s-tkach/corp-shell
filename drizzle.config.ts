import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shell/lib/db/schema.ts",
  out: "./src/shell/lib/db/migrations",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "",
  },
});
