import path from "node:path";
import { defineConfig } from "vitest/config";

const databaseUrl = process.env.TEST_DATABASE_URL || "postgresql://hub:hub@127.0.0.1:5432/hub_test";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
    env: {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      AUTH_URL: "http://localhost:3000",
      AUTH_DEV_LOGIN: "true",
      EMAIL_FROM: "hub@localhost",
    },
    server: {
      deps: {
        inline: ["next-auth"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // next-auth imports these extensionless paths. Node's loader, which Vitest uses
      // for this package, does not add the .js suffix Next's bundler would.
      "next/server": path.resolve(__dirname, "node_modules/next/server.js"),
      "next/headers": path.resolve(__dirname, "node_modules/next/headers.js"),
      "next/navigation": path.resolve(__dirname, "node_modules/next/navigation.js"),
    },
  },
});
