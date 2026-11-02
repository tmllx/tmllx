import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type HubDb = NodePgDatabase<typeof schema>;

function isNeonUrl(url: string): boolean {
  return url.includes(".neon.tech") || process.env.DATABASE_DRIVER === "neon";
}

function createDb(url: string) {
  if (isNeonUrl(url)) {
    // The HTTP driver cannot run a transaction. The WebSocket pool can,
    // which album replacement needs so a failed insert does not leave the list empty.
    if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;
    const pool = new NeonPool({ connectionString: url });
    return drizzleNeon(pool, { schema }) as unknown as HubDb;
  }
  const pool = new Pool({ connectionString: url, max: 5 });
  return drizzlePg(pool, { schema });
}

let cached: HubDb | null = null;
let cachedUrl: string | null = null;

export function getDb(): HubDb {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached || cachedUrl !== url) {
    cached = createDb(url);
    cachedUrl = url;
  }
  return cached;
}
