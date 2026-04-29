import type { TestSiteConfigs } from "./src/types/test-sites";
import type { DatabaseConfigType } from "./src/types/database";

export const SUBMODULES_PATH = `${process.cwd()}/submodules` as const;

const DATABASE_NAME = "benchmark";
const DATABASE_USER = "benchmark";
const DATABASE_PASSWORD = "benchmark";
const DATABASE_HOST = "localhost";
const DATABASE_PORT = "5432";

export const DatabaseConfig: DatabaseConfigType = {
  submoduleName: "database-seed",
  prepare: {
    command: "docker compose up -d",
    regex: "Container database-seed-db-1  Running",
  },
  start: {
    command: "docker compose up -d",
    regex: "Container database-seed-db-1  Running",
  },
  reset: {
    command: "docker compose up -d",
    regex: "Container database-seed-db-1  Running",
  },
  connectionString: `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`,
};

/**
 * The key to every configuration must match the
 */
export const TestSites: TestSiteConfigs = {
  "test-site-asp-net": {
    prepare: "cd test-site && dotnet restore",
    start: "dotnet run",
    startDetectionRegex:
      "(\\[@astrojs\\/node\\] Server listening on http:\\/\\/localhost:)",
    environmentVariables: { ASPNETCORE_ENVIRONMENT: "Production" },
  },
  "test-site-astro-htmx": {
    prepare: "npm install-clean && npm run build",
    start: "node ./dist/server/entry.mjs",
    startDetectionRegex:
      "(\\[@astrojs\\/node\\] Server listening on http:\\/\\/localhost:)",
  },
  "test-site-nextjs": {
    prepare:
      "npm install-clean && npm run build && cp -r .next/static .next/standalone/.next/",
    start: "node .next/standalone/server.js",
    startDetectionRegex: "✓ Ready in ",
  },
} as const;
