import { Pool } from "pg";

const globalDb = globalThis as typeof globalThis & { teamPool?: Pool };

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt.");
  if (!globalDb.teamPool) {
    globalDb.teamPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 20_000,
    });
    globalDb.teamPool.on("error", (error) => console.error("Datenbank-Poolfehler", error));
  }
  return globalDb.teamPool;
}
