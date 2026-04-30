import path from "node:path";
import {
  Command,
  TestSiteConfig,
  type TestSiteConfigs,
} from "./src/types/test-sites";
import type { DatabaseConfigType } from "./src/types/database";

export const SUBMODULES_PATH = `${process.cwd()}/submodules` as const;

const DATABASE_NAME = "benchmark";
const DATABASE_USER = "benchmark";
const DATABASE_PASSWORD = "benchmark";
const DATABASE_HOST = "localhost";
const DATABASE_PORT = "5432";

export const DATABASE_CONFIG: DatabaseConfigType = {
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
 * The key to every configuration must match the submodule name
 */
export const TEST_SITE_CONFIG: TestSiteConfigs = {
  "test-site-asp-net": {
    prepare: new Command({
      command: "dotnet restore",
      modifyWorkingPath: (projectPath: string) =>
        path.join(projectPath, "test-site"),
    }),
    start: new Command({
      command: "dotnet run",
      environment: {
        ASPNETCORE_ENVIRONMENT: "Production",
        ConnectionStrings__DefaultConnection: `Host=${DATABASE_HOST};Port=${DATABASE_PORT};Database=${DATABASE_NAME};Username=${DATABASE_USER};Password=${DATABASE_PASSWORD}`,
      },
      modifyWorkingPath: (projectPath: string) =>
        path.join(projectPath, "test-site"),
    }),
    startDetectionRegex: "Application started.",
    portIdentifier: "PORT",
  },
  "test-site-ruby-rails-hotwire": {
    prepare: [
      new Command({
        command: "bundle install --gemfile Gemfile",
        environment: {
          RAILS_ENV: "production",
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          SECRET_KEY_BASE_DUMMY: "1",
        },
      }),
      new Command({
        command: "rails assets:precompile",
        environment: {
          RAILS_ENV: "production",
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          SECRET_KEY_BASE_DUMMY: "1",
        },
        modifyWorkingPath: (p) => path.join(p, "bin"),
      }),
    ],
    start: new Command({
      command: "thrust rails server",
      environment: {
        RAILS_ENV: "production",
        DATABASE_URL: DATABASE_CONFIG.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
      modifyWorkingPath: (p) => path.join(p, "bin"),
    }),
    startDetectionRegex: "Server started",
    portIdentifier: "HTTP_PORT",
  },
  "test-site-ruby-rails-htmx": {
    prepare: [
      new Command({
        command: "bundle install --gemfile Gemfile",
        environment: {
          RAILS_ENV: "production",
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          SECRET_KEY_BASE_DUMMY: "1",
        },
      }),
      new Command({
        command: "rails assets:precompile",
        environment: {
          RAILS_ENV: "production",
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          SECRET_KEY_BASE_DUMMY: "1",
        },
        modifyWorkingPath: (p) => path.join(p, "bin"),
      }),
    ],
    start: new Command({
      command: "thrust rails server",
      environment: {
        RAILS_ENV: "production",
        DATABASE_URL: DATABASE_CONFIG.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
      modifyWorkingPath: (p) => path.join(p, "bin"),
    }),
    startDetectionRegex: "Server started",
    portIdentifier: "HTTP_PORT",
  },
  "test-site-astro-htmx": {
    prepare: [
      new Command({ command: "npm install-clean" }),
      new Command({ command: "npm run build" }),
    ],
    start: new Command({
      command: "npm run serve",
      environment: {
        DATABASE_URL: DATABASE_CONFIG.connectionString,
      },
    }),
    startDetectionRegex: "Server listening on",
    portIdentifier: "PORT",
  },
  "test-site-nextjs": {
    prepare: [
      new Command({ command: "npm install-clean" }),
      new Command({ command: "npm run build" }),
      new Command({ command: "cp -r .next/static .next/standalone/.next/" }),
    ],
    start: new Command({
      command: "node .next/standalone/server.js",
      environment: {
        DATABASE_URL: DATABASE_CONFIG.connectionString,
      },
    }),
    startDetectionRegex: "✓ Ready in ",
    portIdentifier: "PORT",
  },
  "test-site-django-htmx": {
    prepare: [
      new Command({
        command: "python3 -m venv django-venv",
      }),
      new Command({
        command: "pip3 install -r requirements.txt",
        environment: {
          VIRTUAL_ENV: (p) => path.join(p, "django_env"),
          PATH: (p) =>
            `${path.join(p, "django_env", "bin")}:${process.env.PATH}`,
        },
        modifyWorkingPath: (p) => path.join(p, "django"),
      }),
    ],
    start: new Command({
      command: "daphne test_site.asgi:application",
      environment: {
        DATABASE_URL: DATABASE_CONFIG.connectionString,
        VIRTUAL_ENV: (p) => path.join(p, "django_env"),
        PATH: (p) => `${path.join(p, "django_env", "bin")}:${process.env.PATH}`,
      },
      modifyWorkingPath: (p) => path.join(p, "django"),
    }),
    startDetectionRegex: "Listening on TCP address",
    portIdentifier: "PORT",
  },
} as const;
