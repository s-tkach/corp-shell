import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const connectionString = process.env["DATABASE_URL"];

let instance: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getDb() {
  if (!instance) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const client = postgres(connectionString, { max: 1 });
    instance = drizzle(client, { schema });
  }
  return instance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
