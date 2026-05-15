import path from "node:path";
import {
  type CommandConfig,
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
    command: "docker compose down -v && docker compose up --wait",
    regex: "Container database-seed-db-1 Healthy",
  },
  start: {
    command: "docker compose up --wait",
    regex: "Container database-seed-db-1 Healthy",
  },
  reset: {
    command: "docker compose down -v && docker compose up --wait",
    regex: "Container database-seed-db-1 Healthy",
  },
  connectionString: `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`,
};

/**
 * The key to every configuration must match the submodule name
 */
export const TEST_SITE_CONFIG: TestSiteConfigs<CommandConfig> = {
  "test-site-asp-net-htmx": {
    prepare: {
      command: "dotnet restore",
      modifyWorkingPath: (projectPath: string) =>
        path.join(projectPath, "test-site"),
    },
    start: {
      command: "dotnet run",
      environment: {
        ASPNETCORE_ENVIRONMENT: "Production",
        ConnectionStrings__DefaultConnection: `Host=${DATABASE_HOST};Port=${DATABASE_PORT};Database=${DATABASE_NAME};Username=${DATABASE_USER};Password=${DATABASE_PASSWORD}`,
      },
      modifyWorkingPath: (projectPath: string) =>
        path.join(projectPath, "test-site"),
    },
    startDetectionRegex: { regex: "Application started.", channel: "stdout" },
    portIdentifier: "PORT",
  },
  "test-site-ruby-rails-hotwire": {
    prepare: [
      {
        command: "bundle install --gemfile Gemfile",
        environment: {
          RAILS_ENV: "production",
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          SECRET_KEY_BASE_DUMMY: "1",
        },
      },
      {
        command: "rails assets:precompile",
        environment: {
          RAILS_ENV: "production",
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          SECRET_KEY_BASE_DUMMY: "1",
        },
        modifyWorkingPath: (p) => path.join(p, "bin"),
      },
    ],
    start: {
      command: "thrust rails server",
      environment: {
        RAILS_ENV: "production",
        DATABASE_URL: DATABASE_CONFIG.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
      modifyWorkingPath: (p) => path.join(p, "bin"),
    },
    startDetectionRegex: { regex: "Server started", channel: "stdout" },
    portIdentifier: "HTTP_PORT",
  },
  "test-site-ruby-rails-htmx": {
    prepare: [
      {
        command: "bundle install --gemfile Gemfile",
        environment: {
          RAILS_ENV: "production",
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          SECRET_KEY_BASE_DUMMY: "1",
        },
      },
      {
        command: "rails assets:precompile",
        environment: {
          RAILS_ENV: "production",
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          SECRET_KEY_BASE_DUMMY: "1",
        },
        modifyWorkingPath: (p) => path.join(p, "bin"),
      },
    ],
    start: {
      command: "thrust rails server",
      environment: {
        RAILS_ENV: "production",
        DATABASE_URL: DATABASE_CONFIG.connectionString,
        SECRET_KEY_BASE_DUMMY: "1",
      },
      modifyWorkingPath: (p) => path.join(p, "bin"),
    },
    startDetectionRegex: { regex: "Server started", channel: "stdout" },
    portIdentifier: "HTTP_PORT",
  },
  "test-site-astro-htmx": {
    prepare: [{ command: "npm install-clean" }, { command: "npm run build" }],
    start: {
      command: "npm run serve",
      environment: {
        DATABASE_URL: DATABASE_CONFIG.connectionString,
      },
    },
    startDetectionRegex: { regex: "Server listening on", channel: "stdout" },
    portIdentifier: "PORT",
  },
  "test-site-nextjs": {
    prepare: [
      { command: "npm install-clean" },
      { command: "npm run build" },
      { command: "cp -r .next/static .next/standalone/.next/" },
    ],
    start: {
      command: "node .next/standalone/server.js",
      environment: {
        DATABASE_URL: DATABASE_CONFIG.connectionString,
      },
    },
    startDetectionRegex: { regex: "✓ Ready in ", channel: "stdout" },
    portIdentifier: "PORT",
  },
  "test-site-django-htmx": {
    portIdentifier: "PORT",
    prepare: [
      {
        command: "python3 -m venv django-venv",
      },
      {
        command: `"${SUBMODULES_PATH}/test-site-django-htmx/django-venv/bin/python" -m pip install -r requirements.txt`,
        environment: {
          VIRTUAL_ENV: (p) => path.join(p, "django-venv"),
          PATH: (p) =>
            `${path.join(p, "django-venv", "bin")}:${process.env.PATH}`,
        },
        modifyWorkingPath: (p) => path.join(p, "django"),
      },
      {
        command: `rm -rf staticfiles`,
        modifyWorkingPath: (p) => path.join(p, "django"),
      },
      {
        command: `"${SUBMODULES_PATH}/test-site-django-htmx/django-venv/bin/python" manage.py collectstatic`,
        environment: {
          DATABASE_URL: DATABASE_CONFIG.connectionString,
          VIRTUAL_ENV: (p) => path.join(p, "django-venv"),
          PATH: (p) =>
            `${path.join(p, "django-venv", "bin")}:${process.env.PATH}`,
        },
        modifyWorkingPath: (p) => path.join(p, "django"),
      },
    ],
    start: {
      command: 'daphne test_site.asgi:application --port "${PORT}"',
      environment: {
        DATABASE_URL: DATABASE_CONFIG.connectionString,
        VIRTUAL_ENV: (p) => path.join(p, "django-venv"),
        PATH: (p) =>
          `${path.join(p, "django-venv", "bin")}:${process.env.PATH}`,
      },
      modifyWorkingPath: (p) => path.join(p, "django"),
    },
    startDetectionRegex: {
      regex: "Listening on TCP address",
      channel: "stderr",
    },
  },
  "test-site-spring-boot-htmx": {
    portIdentifier: "PORT",
    prepare: { command: "./gradlew build" },
    start: {
      command: `java -jar ${path.join(SUBMODULES_PATH, "test-site-spring-boot-htmx/build/libs/test-site-spring-boot-htmx-*.jar")}`,
      environment: {
        SPRING_DATASOURCE_URL: `jdbc:postgresql://${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`,
        SPRING_DATASOURCE_USERNAME: DATABASE_USER,
        SPRING_DATASOURCE_PASSWORD: DATABASE_PASSWORD,
      },
    },
    startDetectionRegex: {
      regex: "Started TestSiteSpringBootHtmxApplication in ",
      channel: "stdout",
    },
  },
} as const;
