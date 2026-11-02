import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type HubDb = NodePgDatabase<typeof schema>;

function isNeonUrl(url: string): boolean {
  return url.includes(".neon.tech") || process.env.DATABASE_DRIVER === "neon";
}

function createDb(url: string) {
  if (isNeonUrl(url)) {
    const sql = neon(url);
    return drizzleHttp(sql, { schema }) as unknown as HubDb;
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
