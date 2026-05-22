import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { Command } from "commander";

import {
  Command as BenchmarkCommand,
  type TestSiteConfigs,
} from "./types/test-sites";
import * as config from "../config";

import {
  ProfilerFeatures,
  ProfilerOptions,
  ProfilerThreads,
} from "./utilities/browser-utilities/profiler-helper";
import startBenchmark from "./utilities/benchmark-runner";

import {
  getBenchmarkNames,
  validateBenchmarks,
} from "./utilities/benchmark-file-helper";
import {
  BuilderOptions,
  defaultSettings as defaultBuilderOptions,
} from "./utilities/browser-utilities/driver-builder";
import { createAsyncProcess, Stream } from "./utilities/process-helper";
import { ConfigStep } from "./types/database";
import Logger, { isLogLevel, type LogLevel } from "./utilities/logging";

const BENCHMARKS_PATH = path.resolve(import.meta.dirname, "./benchmarks/");

// Transform TestSiteConfig to use Command instances
const TRANSFORMED_TEST_SITE_CONFIG: TestSiteConfigs = {};
for (const [name, siteConfig] of Object.entries(config.TEST_SITE_CONFIG)) {
  TRANSFORMED_TEST_SITE_CONFIG[name] = {
    ...siteConfig,
    prepare: siteConfig.prepare
      ? Array.isArray(siteConfig.prepare)
        ? siteConfig.prepare.map((prepare) => new BenchmarkCommand(prepare))
        : new BenchmarkCommand(siteConfig.prepare)
      : undefined,
    start: new BenchmarkCommand(siteConfig.start),
  };
}

export type InputOptions = {
  serverLogLevel: LogLevel;
  serverPort: number;
  profilerOptions: ProfilerOptions;
  driverOptions: BuilderOptions;
  iterations: number;
  chosenBenchmarks: string[];
  chosenFrameworks: TestSiteConfigs;
  benchmarksPath: string;
  processEnergyMeasurementPath: string | undefined;
  outputPath: string;
};

const inputOptions: InputOptions = {
  serverLogLevel: "error",
  serverPort: 0,
  profilerOptions: {
    entries: 0,
    interval: 0,
    features: [],
    threads: [],
  },
  driverOptions: defaultBuilderOptions,
  iterations: 0,
  chosenBenchmarks: [],
  chosenFrameworks: {},
  benchmarksPath: BENCHMARKS_PATH,
  processEnergyMeasurementPath: undefined,
  outputPath: "",
};

const program = new Command();

(async () => {
  program
    .name("Benchmark Runner")
    .description(
      "A CLI for running performance focused benchmarks in the Firefox browser, using selenium",
    )
    .version("1.0.0")
    .option(
      "-p, --port <port>",
      "specify port used for serving the websites",
      "1337",
    )
    .option(
      "--log-level <log-level>",
      "specify which logs the benchmark runner should print to terminal (debug, info, warning, error, off)",
      "error",
    )
    .option(
      "--log-level-server <log-level-server>",
      "specify which logs the server should print to terminal (debug, info, warning, error, off)",
      "error",
    )
    .option("-d, --debug", "launch browser instances with debugger")
    .option(
      "-o, --output-path <output-path>",
      "sets the path to the output folder",
      "./profiler-results",
    )
    .option(
      "--entries <entries>",
      "specify the buffer size used in the profiler",
      "20000000",
    )
    .option(
      "--interval <interval>",
      "specify the profiler logging interval (ms)",
      "100",
    )
    .option(
      "--features <features...>",
      `specify the logged features. Available features: ${Object.values(
        ProfilerFeatures,
      ).join(", ")}`,
      ["power", "bandwidth"],
    )
    .option(
      "--threads <threads...>",
      `specify the logged threads. Available threads: ${Object.values(
        ProfilerThreads,
      ).join(", ")}`,
      ["GeckoMain"],
    )
    .option(
      "--iterations <iterations>",
      `specify the number of test iterations`,
      "1",
    )
    .option(
      "--benchmarks <benchmarks...>",
      `specify the benchmarks. Available benchmarks: ${(await getBenchmarkNames(BENCHMARKS_PATH)).join(", ")}`,
      ["static", "live", "list", "list-interact", "home-interact", "navigate"],
    )
    .option(
      "--test-sites <test-sites...>",
      `specify the test-sites. Available test-sites: ${Object.keys(config.TEST_SITE_CONFIG).join(", ")}`,
    )
    .option(
      "--process-energy-measurement <path>",
      `path to the process-energy-measurement executable. Enables measuring the server process`,
    )
    .option(
      "--store-warmup-rounds",
      `store or discard measurements obtained during warmup rounds`,
    );

  // Parse program and extract options
  program.parse();
  const options = program.opts();

  /** Handle port flag */
  if (options.port) {
    const port = Number.parseInt(options.port);

    if (Number.isNaN(port))
      throw new Error(`"${options.port}" in not an integer`);

    if (port < 0 || port > 65535)
      throw new Error(`The port must be within 0-65535`);

    inputOptions.serverPort = port;
  }

  /** Handle debug flag */
  if (options.debug) {
    inputOptions.driverOptions.debug = true;
  }

  /** Handle log-level flags */
  const handleLogLevel = (option: unknown, fn: (level: LogLevel) => void) => {
    if (!option || !isLogLevel(option)) {
      throw new Error(`Provided log level is invalid`);
    }

    fn(option);
  };

  handleLogLevel(options.logLevel, (l) => {
    Logger.level = l;
  });
  handleLogLevel(options.logLevelServer, (l) => {
    inputOptions.serverLogLevel = l;
  });

  /** Handle output-path flag */
  if (options.outputPath) {
    const outputPath = options.outputPath;

    if (typeof outputPath !== "string")
      throw new Error(
        `"${outputPath}" is not a valid output path - is not a string`,
      );

    inputOptions.outputPath = outputPath;
  }

  /** Handle entries flag */
  if (options.entries) {
    const entries = Number.parseInt(options.entries);

    if (Number.isNaN(entries))
      throw new Error(
        `"${options.entries}" is not a valid buffer size - is not an integer`,
      );

    if (entries <= 0)
      throw new Error(
        `"${options.entries}" is not a valid buffer size - must be larger than 0`,
      );

    inputOptions.profilerOptions.entries = entries;
  }

  /** Handle interval flag */
  if (options.interval) {
    const interval = Number.parseInt(options.interval);

    if (Number.isNaN(interval)) {
      throw new Error(
        `"${options.interval}" is not a valid interval - is not an integer`,
      );
    }

    if (interval <= 0)
      throw new Error(
        `"${options.interval}" is not a valid interval - must be larger than 0`,
      );

    inputOptions.profilerOptions.interval = interval;
  }

  function isFeature(input: string): input is ProfilerFeatures {
    return (Object.values(ProfilerFeatures) as string[]).includes(input);
  }

  /** Handle features flag */
  if (options.features) {
    const features = options.features;
    if (!Array.isArray(features)) {
      throw new Error(`"${features}" is not an array`);
    }

    if (!features.every((f) => typeof f === "string" && isFeature(f))) {
      throw new Error(`"${features} contain an invalid feature"`);
    }

    inputOptions.profilerOptions.features = features;
  }

  function isThread(input: string): input is ProfilerThreads {
    return (Object.values(ProfilerThreads) as string[]).includes(input);
  }

  /** Handle threads flag */
  if (options.threads) {
    const threads = options.threads;
    if (!Array.isArray(threads)) {
      throw new Error(`"${threads}" is not an array`);
    }

    if (!threads.every((f) => typeof f === "string" && isThread(f))) {
      throw new Error(`"${threads} contain an invalid feature"`);
    }

    inputOptions.profilerOptions.threads = threads;
  }

  /** Handle iterations flag */
  if (options.iterations) {
    const iterations = Number.parseInt(options.iterations);

    if (Number.isNaN(iterations)) {
      throw new Error(
        `"${options.iterations}" is not a valid repetition count - is not an integer`,
      );
    }

    if (iterations <= 0)
      throw new Error(
        `"${options.iterations}" is not a valid repetition count - must be larger than 0`,
      );

    inputOptions.iterations = iterations;
  }

  /** Handle benchmarks flag */
  if (options.benchmarks) {
    const benchmarks = options.benchmarks;
    if (!Array.isArray(benchmarks)) {
      throw new Error(`"${benchmarks}" is not an array`);
    }

    if (
      !benchmarks.every((f) => typeof f === "string") ||
      !validateBenchmarks(BENCHMARKS_PATH, benchmarks)
    ) {
      throw new Error(`"${benchmarks} contain an invalid benchmark"`);
    }

    inputOptions.chosenBenchmarks = benchmarks;
  }

  /** Handle framework flag */
  if (options.testSites) {
    const testSites = options.testSites;
    if (!Array.isArray(testSites)) {
      throw new Error(`"${testSites}" is not an array`);
    }

    const validFrameworks = Object.keys(TRANSFORMED_TEST_SITE_CONFIG);

    const testSiteConfigs: TestSiteConfigs = {};

    for (const testSite of testSites) {
      if (typeof testSite !== "string" || !validFrameworks.includes(testSite))
        throw new Error(`"${testSites} contain an invalid framework"`);

      // Using ! as we are sure that it is defined
      testSiteConfigs[testSite] = TRANSFORMED_TEST_SITE_CONFIG[testSite]!;
    }

    inputOptions.chosenFrameworks = testSiteConfigs;
  } else {
    inputOptions.chosenFrameworks = TRANSFORMED_TEST_SITE_CONFIG;
  }

  /** Handle process energy measurement flag */
  if (options.processEnergyMeasurement) {
    if (typeof options.processEnergyMeasurement !== "string") {
      throw new Error(
        `"${options.processEnergyMeasurement}" is not a valid executable path - is not a string`,
      );
    }

    if (!existsSync(options.processEnergyMeasurement)) {
      throw new Error(
        `"${options.processEnergyMeasurement}" is not a valid executable path - is not valid path to a file`,
      );
    }

    inputOptions.processEnergyMeasurementPath =
      options.processEnergyMeasurement;
  }

  Logger.log("info", "Successfully parsed input parameters");

  // Run db prepare and start script
  if (config.DATABASE_CONFIG) {
    const dbSteps: [string, ConfigStep][] = [
      ["Preparing database", config.DATABASE_CONFIG.prepare],
      ["Starting database", config.DATABASE_CONFIG.start],
    ];

    for (const [step, configStep] of dbSteps) {
      Logger.log("debug", "Database preparation step - ", step);
      await createAsyncProcess({
        command: configStep.command,
        cwd: `${config.SUBMODULES_PATH}/${config.DATABASE_CONFIG.submoduleName}`,
        regex: configStep.regex,
        stream: Stream.stderr,
      });
    }
  }

  // Run test-site prepare script
  Logger.log("info", "Preparing test-sites");
  await Promise.all(
    Object.entries(TRANSFORMED_TEST_SITE_CONFIG).map(
      async ([name, testSiteConfig]) => {
        const shouldBeTested =
          inputOptions.chosenFrameworks === undefined ||
          name in inputOptions.chosenFrameworks;

        Logger.log("debug", `${name} should be tested: ${shouldBeTested}`);
        Logger.log(
          "debug",
          `${name} has preparation config: ${testSiteConfig.prepare ? true : false}`,
        );

        if (!shouldBeTested || !testSiteConfig.prepare) return;

        const submodulePath = path.join(config.SUBMODULES_PATH, name);
        const prepareCommands = Array.isArray(testSiteConfig.prepare)
          ? testSiteConfig.prepare
          : [testSiteConfig.prepare];

        for (const prepareCommand of prepareCommands) {
          await createAsyncProcess({
            command: prepareCommand.command,
            cwd: prepareCommand.workingPath(submodulePath),
            env: prepareCommand.env(submodulePath),
          });
        }
      },
    ),
  );

  Logger.log("info", "Finished preparation - starting benchmark");
  await startBenchmark(inputOptions);
})();
