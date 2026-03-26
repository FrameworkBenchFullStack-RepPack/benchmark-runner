import type { TestSiteConfigsType } from "./src/types/test-sites";
import type { DatabaseConfigType } from "./src/types/database";

export const SUBMODULES_PATH = `${process.cwd()}/submodules` as const;

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
  connectionString: "postgresql://benchmark:benchmark@localhost:5432/benchmark",
};

/**
 * The key to every configuration must match the
 */
export const TestSites: TestSiteConfigsType = {
  "test-site-astro-htmx": {
    prepare: "npm install-clean && npm run build",
    start: "node ./dist/server/entry.mjs",
    startDetectionRegex:
      "(\\[@astrojs\\/node\\] Server listening on http:\\/\\/localhost:)",
  },
} as const;
