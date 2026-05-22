import fs from "node:fs";
import path from "node:path";

import { SUBMODULES_PATH, DATABASE_CONFIG } from "../../config";
import type { InputOptions } from "../index";
import type BenchmarkInput from "../benchmarks/benchmark-types";

import { loadBenchmarks } from "./benchmark-file-helper";
import { createAsyncProcess, Stream } from "./process-helper";
import { createServerController } from "./server-worker/create-server-controller";
import Logger from "./logging";

/**
 * Function to perform the benchmark on each test-site
 * @param options Profiler options for the firefox profiler
 * @param port The port to be used to host each test-site
 */
export default async function startBenchmark(options: InputOptions) {
  if (options.processEnergyMeasurementPath)
    Logger.log("info", "Server process energy measurement enabled");

  /** Start database if necessary */
  if (DATABASE_CONFIG) {
    Logger.log("info", "Starting database");
    await createAsyncProcess({
      command: DATABASE_CONFIG.start.command,
      regex: DATABASE_CONFIG.start.regex,
      cwd: `${SUBMODULES_PATH}/${DATABASE_CONFIG.submoduleName}`,
      stream: Stream.stderr,
    });
  }

  /** Create output path */
  const RESULTS_PATH = path.resolve(
    options.outputPath,
    String(Math.round(Date.now() / 1000 / 10)),
  );

  /** Make sure the results folder exists */
  if (!fs.existsSync(options.outputPath)) fs.mkdirSync(options.outputPath);
  if (!fs.existsSync(RESULTS_PATH)) fs.mkdirSync(RESULTS_PATH);

  /** Determine test-sites to be benchmarked */
  const testSites = options.chosenFrameworks;
  Logger.log(
    "info",
    "Testing configured for - ",
    ...Object.keys(testSites).join(", "),
  );

  /** Loop through every repetitions */
  for (let repetition = 1; repetition <= options.repetitions; repetition++) {
    /** Loop through every test-site and perform the benchmark */
    for (const [testSiteName, testSiteConfig] of Object.entries(testSites)) {
      Logger.log(
        "debug",
        `Performing iteration '${repetition}' on test-site '${testSiteName}'`,
      );

      const server = createServerController(
        options,
        testSiteName,
        testSiteConfig,
      );

      await server.waitUntilReady();

      const benchmarkInput: BenchmarkInput = {
        framework: testSiteName,
        repetition,
        resultsPath: RESULTS_PATH,
        link: `http://localhost:${options.serverPort}`,
        profilerOptions: options.profilerOptions,
        driverOptions: options.driverOptions,
        setServerResultPath: server.setResultPath,
        startServerMeasurement: server.startMeasurement,
        stopServerMeasurement: server.stopMeasurement,
      };

      try {
        // Perform select benchmark
        const benchmarks = await loadBenchmarks(
          options.benchmarksPath,
          options.chosenBenchmarks,
        );
        for (const [
          benchmarkIndex,
          [benchmarkName, benchmark],
        ] of benchmarks.entries()) {
          Logger.log(
            "info",
            `Benchmarking ${testSiteName} with ${benchmarkName}.. (benchmark ${benchmarkIndex + 1}/${benchmarks.length}) (repetition ${repetition}/${options.repetitions})`,
          );
          await benchmark(benchmarkInput);
        }

        Logger.log(
          "info",
          `Finished iteration ${repetition} for ${testSiteName}`,
        );
      } finally {
        // Terminate server
        await server.terminate();
        Logger.log("debug", `Terminated ${testSiteName} server`);
      }
    }

    /** Reset database if necessary */
    if (DATABASE_CONFIG) {
      Logger.log("debug", `Resetting database`);
      await createAsyncProcess({
        command: DATABASE_CONFIG.reset.command,
        regex: DATABASE_CONFIG.reset.regex,
        cwd: `${SUBMODULES_PATH}/${DATABASE_CONFIG.submoduleName}`,
        stream: Stream.stderr,
      });
    }
  }
}
