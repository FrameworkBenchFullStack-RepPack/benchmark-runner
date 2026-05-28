import os from "os";
import path from "path";
import { existsSync } from "fs";
import { Builder, Capabilities } from "selenium-webdriver";
import { Driver, ServiceBuilder, Options } from "selenium-webdriver/firefox";

import Logger from "../logging";
import { promisifiedTimeout } from "../benchmark-utilities";

/** Constants */
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 1000;

/** Default Firefox executable locations */
const firefoxExecutableMap: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "/Applications/Firefox.app/Contents/MacOS/firefox",
  linux: "/usr/lib/firefox/firefox",
};

/** Geckodriver executable locations */
const geckodriverExecutableMap: Partial<
  Record<NodeJS.Platform, Partial<Record<NodeJS.Architecture, string>>>
> = {
  darwin: {
    arm64: "geckodriver-v0_36_0-macos-aarch64",
  },
  linux: {
    x64: "geckodriver-v0_36_0-linux64",
  },
};

function validateExecutables(): {
  firefoxPath: string;
  geckodriverPath: string;
} {
  const platform = os.platform();
  const architecture = os.arch();

  /** Validate Firefox executable path */
  const firefoxPath = firefoxExecutableMap[platform];
  if (!firefoxPath)
    throw new Error(`No Firefox executable defined for platform: ${platform}`);

  if (!existsSync(firefoxPath))
    throw new Error(`Firefox executable not found at path: "${firefoxPath}"`);

  /** Validate Geckodriver path */
  const geckodriverPlatform = geckodriverExecutableMap[platform];
  if (!geckodriverPlatform)
    throw new Error(`No geckodriver definitions for platform: ${platform}`);

  const geckodriverPath = geckodriverPlatform[architecture];
  if (!geckodriverPath)
    throw new Error(
      `No geckodriver defined for platform: ${platform}, architecture: ${architecture}`,
    );

  if (!(platform === "darwin" && architecture === "arm64")) {
    Logger.log(
      "warning",
      "This combination of platform and architecture does not support per-process power measurements in Firefox.",
    );
  }

  Logger.log(
    "debug",
    `Resolved executables - Firefox: ${firefoxPath}, geckodriver: ${geckodriverPath}`,
  );

  return { firefoxPath, geckodriverPath };
}

export type BuilderOptions = {
  headless: boolean;
  debug: boolean;
  env: [string, string][];
};

export const defaultSettings: BuilderOptions = {
  headless: false,
  debug: false,
  env: [],
} as const;

async function prepareWebDriver(
  options: BuilderOptions = defaultSettings,
): Promise<Driver | undefined> {
  const browserOptions = new Options();
  const capabilities = Capabilities.firefox();
  capabilities.setPageLoadStrategy("normal");

  const builder = new Builder()
    .forBrowser("firefox")
    .withCapabilities(capabilities);

  const paths = validateExecutables();

  // Configure service builder - Geckodriver handler
  const serviceBuilder = new ServiceBuilder(
    path.join(process.cwd(), `/geckodriver/${paths.geckodriverPath}`),
  );

  serviceBuilder.addArguments("--allow-system-access");
  builder.setFirefoxService(serviceBuilder);

  // Open debugger if necessary
  if (options.debug) {
    browserOptions.addArguments("--devtools");
    browserOptions.setPreference("detach", true);
  }

  // Enable devtools for browser chrome
  browserOptions.setPreference("devtools.chrome.enabled", true);

  // Set Binary
  browserOptions.setBinary(paths.firefoxPath);

  // Prevent from connecting to existing Firefox instance
  browserOptions.addArguments("-no-remote");

  // Enable Bidi protocol
  browserOptions.enableBidi();

  // Set environment variables
  for (const [key, val] of options.env) {
    process.env[key] = val;
  }

  // Set Caching preferences
  browserOptions.setPreference("browser.cache.disk.enable", false);
  browserOptions.setPreference("browser.cache.memory.enable", true);
  browserOptions.setPreference("network.http.use-cache", true);

  builder.setFirefoxOptions(browserOptions);

  // Build driver and return
  const driver = await builder.build();

  return driver as Driver;
}

export async function getWebDriver(
  options: BuilderOptions = defaultSettings,
): Promise<Driver | undefined> {
  Logger.log(
    "debug",
    `Building webdriver - headless: ${options.headless}, debug: ${options.debug}`,
  );

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const driver = await prepareWebDriver(options);

      Logger.log(
        "debug",
        `Webdriver initialized successfully on attempt ${attempt}`,
      );

      return driver;
    } catch (error) {
      const isLastAttempt = attempt >= MAX_RETRIES;

      Logger.log(
        isLastAttempt ? "error" : "warning",
        `Webdriver initialization failed on attempt ${attempt}/${MAX_RETRIES}`,
        isLastAttempt ? "" : ". Retrying...",
        error,
      );

      if (isLastAttempt) return undefined;

      // Exponential backoff
      const delay = BASE_RETRY_DELAY * 2 ** (attempt - 1);
      Logger.log("debug", `Waiting ${delay}ms before retrying`);

      await promisifiedTimeout(delay);
    }
  }

  return undefined;
}
