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
    prepare: {
      command: "dotnet restore",
      modifyWorkingPath: (projectPath: string) =>
        path.join(projectPath, "test-site"),
    },
    start: {
      command: "dotnet run",
      modifyWorkingPath: (projectPath: string) =>
        path.join(projectPath, "test-site"),
    },
    startDetectionRegex: "Application started.",
    environmentVariables: {
      portIdentifier: "PORT",
      start: {
        ASPNETCORE_ENVIRONMENT: "Production",
        ConnectionStrings__DefaultConnection: `Host=${DATABASE_HOST};Port=${DATABASE_PORT};Database=${DATABASE_NAME};Username=${DATABASE_USER};Password=${DATABASE_PASSWORD}`,
      },
    },
  },
  "test-site-ruby-rails-hotwire": {
    prepare: [
      {
        command: "bundle install --gemfile Gemfile",
      },
      {
        command: "rails assets:precompile",
        modifyWorkingPath: (p) => path.join(p, "bin"),
      },
    ],
    start: {
      command: "thrust rails server",
      modifyWorkingPath: (p) => path.join(p, "bin"),
    },
    startDetectionRegex: "Server started",
    environmentVariables: {
      portIdentifier: "HTTP_PORT",
      start: {
        RAILS_ENV: "production",
        DATABASE_URL: DatabaseConfig.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
      prepare: {
        RAILS_ENV: "production",
        DATABASE_URL: DatabaseConfig.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
    },
  },
  "test-site-ruby-rails-htmx": {
    prepare: [
      {
        command: "bundle install --gemfile Gemfile",
      },
      {
        command: "rails assets:precompile",
        modifyWorkingPath: (p) => path.join(p, "bin"),
      },
    ],
    start: {
      command: "thrust rails server",
      modifyWorkingPath: (p) => path.join(p, "bin"),
    },
    startDetectionRegex: "Server started",
    environmentVariables: {
      portIdentifier: "HTTP_PORT",
      start: {
        RAILS_ENV: "production",
        DATABASE_URL: DatabaseConfig.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
      prepare: {
        RAILS_ENV: "production",
        DATABASE_URL: DatabaseConfig.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
    },
  },
  "test-site-astro-htmx": {
    prepare: [{ command: "npm install-clean" }, { command: "npm run build" }],
    start: { command: "npm run serve" },
    startDetectionRegex: "Server listening on",
    environmentVariables: {
      portIdentifier: "PORT",
      start: {
        DATABASE_URL: DatabaseConfig.connectionString,
      },
    },
  },
  "test-site-nextjs": {
    prepare: [
      { command: "npm install-clean" },
      { command: "npm run build" },
      { command: "cp -r .next/static .next/standalone/.next/" },
    ],
    start: { command: "node .next/standalone/server.js" },
    startDetectionRegex: "✓ Ready in ",
    environmentVariables: {
      portIdentifier: "PORT",
      start: {
        DATABASE_URL: DatabaseConfig.connectionString,
      },
    },
  },
  "test-site-django-htmx": {
    prepare: {
      command: "pip3 install -r requirements.txt",
      modifyWorkingPath: (p) => path.join(p, "django"),
    },
    start: {
      command: "daphne test_site.asgi:application",
      modifyWorkingPath: (p) => path.join(p, "django"),
    },
    startDetectionRegex: "Listening on TCP address",
    environmentVariables: {
      portIdentifier: "PORT",
      start: {
        DATABASE_URL: DatabaseConfig.connectionString,
      },
    },
  },
} as const;
