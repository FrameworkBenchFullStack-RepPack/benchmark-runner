import fs from "node:fs";
import path from "node:path";

import { SUBMODULES_PATH, DATABASE_CONFIG } from "../../config";
import type { InputOptions } from "../index";
import type BenchmarkInput from "../benchmarks/benchmark-types";

import { loadBenchmarks } from "./benchmark-file-helper";
import { createAsyncProcess, Stream } from "./process-helper";
import { createServerController } from "./server-worker/create-server-controller";
import Logger from "./logging";

const RESULTS_ROOT = path.resolve(process.cwd(), "profiler-results");
const RESULTS_PATH = path.resolve(
  RESULTS_ROOT,
  String(Math.round(Date.now() / 1000 / 10)),
);

const MAX_ATTEMPTS = 5;

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

  /** Make sure the results folder exists */
  if (!fs.existsSync(RESULTS_ROOT)) fs.mkdirSync(RESULTS_ROOT);
  if (!fs.existsSync(RESULTS_PATH)) fs.mkdirSync(RESULTS_PATH);

  /** Determine test-sites to be benchmarked */
  const testSites = options.chosenFrameworks;
  Logger.log(
    "info",
    "Testing configured for - ",
    ...Object.keys(testSites).join(", "),
  );

  /** Load benchmarks */
  const benchmarks = await loadBenchmarks(
    options.benchmarksPath,
    options.chosenBenchmarks,
  );

  /** Loop through every iterations */
  for (let iteration = 1; iteration <= options.iterations; iteration++) {
    /** Loop through every test-site and perform the benchmark */
    for (const [testSiteName, testSiteConfig] of Object.entries(testSites)) {
      /** Loop through each of the chosen benchmark */
      for (const [
        benchmarkIndex,
        [benchmarkName, benchmark],
      ] of benchmarks.entries()) {
        Logger.log(
          "debug",
          `Performing iteration '${iteration}' for test-site '${testSiteName}'`,
        );

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          if (attempt > 1)
            Logger.log(
              "warning",
              `Retrying benchmark '${benchmarkName}' for '${testSiteName}' (attempt ${attempt}/${5})`,
            );

          /** Prepare and wait for server */
          const server = createServerController(
            options,
            testSiteName,
            testSiteConfig,
          );

          await server.waitUntilReady();

          /** Perform select warmup rounds per benchmark */
          try {
            for (
              let warmupRound = 1;
              warmupRound <= options.warmupRounds + 1;
              warmupRound++
            ) {
              const benchmarkInput: BenchmarkInput = {
                framework: testSiteName,
                iteration,
                warmupRound,
                resultsPath: RESULTS_PATH,
                link: `http://localhost:${options.serverPort}`,
                profilerOptions: options.profilerOptions,
                driverOptions: options.driverOptions,
                setServerResultPath: server.setResultPath,
                startServerMeasurement: server.startMeasurement,
                stopServerMeasurement: server.stopMeasurement,
              };

              Logger.log(
                "info",
                `Benchmarking ${testSiteName} with ${benchmarkName}.. (benchmark ${benchmarkIndex + 1}/${benchmarks.length}) (iteration ${iteration}/${options.iterations}) (round ${warmupRound}/${options.warmupRounds + 1})`,
              );
              await benchmark(benchmarkInput);
            }

            /** Successful execution - break retry loop */
            Logger.log(
              "info",
              `Finished iteration ${iteration} for ${testSiteName}`,
            );
            break;
          } catch (error) {
            if (attempt > MAX_ATTEMPTS) throw error;
          } finally {
            // Terminate server
            await server.terminate();
            Logger.log("debug", `Terminated ${testSiteName} server`);

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
      }
    }
  }
}
