import { execSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || "postgresql://hub:hub@127.0.0.1:5432/hub_test";
process.env.DATABASE_URL = databaseUrl;

execSync("npx drizzle-kit push --force", {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
