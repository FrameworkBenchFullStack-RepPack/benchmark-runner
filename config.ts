import path from "node:path";
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
    regex: "Running",
  },
  start: {
    command: "docker compose up -d",
    regex: "Running",
  },
  reset: {
    command: "docker compose up -d",
    regex: "Running",
  },
  connectionString: `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`,
};

/**
 * The key to every configuration must match the
 */
export const TestSites: TestSiteConfigs = {
  "test-site-asp-net": {
    prepare: "dotnet restore",
    start: "dotnet run",
    startDetectionRegex: "Application started.",
    environmentVariables: {
      portIdentifier: "PORT",
      start: {
        ASPNETCORE_ENVIRONMENT: "Production",
        ConnectionStrings__DefaultConnection: `Host=${DATABASE_HOST};Port=${DATABASE_PORT};Database=${DATABASE_NAME};Username=${DATABASE_USER};Password=${DATABASE_PASSWORD}`,
      },
    },
    modifyWorkingPath: (projectPath: string) =>
      path.join(projectPath, "test-site"),
  },
  "test-site-ruby-rails-hotwire": {
    prepare: "bundle install --gemfile Gemfile && bin/rails assets:precompile",
    start: "bin/thrust bin/rails server",
    startDetectionRegex: "Server started",
    environmentVariables: {
      portIdentifier: "HTTP_PORT",
      start: {
        RAILS_ENV: "production",
        DATABASE_URL: DatabaseConfig.connectionString,
      },
      prepare: {
        RAILS_ENV: "production",
        DATABASE_URL: DatabaseConfig.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
    },
  },
  "test-site-astro-htmx": {
    prepare: "npm install-clean && npm run build",
    start: "npm run serve",
    startDetectionRegex: "Server listening on",
    environmentVariables: {
      portIdentifier: "PORT",
      start: {
        DATABASE_URL: DatabaseConfig.connectionString,
      },
    },
  },
  "test-site-nextjs": {
    prepare:
      "npm install-clean && npm run build && cp -r .next/static .next/standalone/.next/",
    start: "node .next/standalone/server.js",
    startDetectionRegex: "✓ Ready in ",
    environmentVariables: {
      portIdentifier: "PORT",
      start: {
        DATABASE_URL: DatabaseConfig.connectionString,
      },
    },
  },
} as const;
