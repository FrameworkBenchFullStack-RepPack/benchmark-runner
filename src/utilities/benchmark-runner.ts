import fs from "node:fs";
import path from "node:path";

import { SUBMODULES_PATH, DATABASE_CONFIG } from "../../config";
import type { InputOptions } from "../index";
import type BenchmarkInput from "../benchmarks/benchmark-types";
import type {
  Command,
  TestSiteConfig,
  TestSiteConfigs,
} from "../types/test-sites";

import { loadBenchmarks } from "./benchmark-file-helper";
import { createAsyncProcess } from "./process-helper";
import {
  createProcessController,
  ProcessController,
} from "./server-worker/create-process-controller";
import Logger from "./logging";
import { performDatabaseAction } from "./database-utilities";

const MAX_ATTEMPTS = 5;

/**
 * Function to rotate frameworks using a rotated round-robin approach
 * @param frameworks Frameworks to rotate
 * @returns A rotated list of frameworks
 */
function getRotatedTestSites(
  frameworks: [string, TestSiteConfig<Command>][],
): [string, TestSiteConfig<Command>][] {
  const [first, ...rest] = frameworks;
  if (first === undefined) throw new Error("First test site is undefined");
  return [...rest, first];
}

/**
 * Function to perform the benchmark on each test-site
 * @param options Profiler options for the firefox profiler
 * @param port The port to be used to host each test-site
 */
export default async function startBenchmark(options: InputOptions) {
  if (options.processEnergyMeasurementPath)
    Logger.log("info", "Server process energy measurement enabled");

  /** Create output path */
  const RESULTS_PATH = path.resolve(
    options.outputPath,
    String(Math.round(Date.now() / 1000 / 10)),
  );

  /** Make sure the results folder exists */
  if (!fs.existsSync(options.outputPath)) fs.mkdirSync(options.outputPath);
  if (!fs.existsSync(RESULTS_PATH)) fs.mkdirSync(RESULTS_PATH);

  /** Determine test-sites to be benchmarked */
  let testSites = Object.entries(options.chosenFrameworks);
  Logger.log(
    "info",
    "Testing configured for -",
    testSites.map(([name, _]) => name).join(", "),
  );

  /** Load benchmarks */
  const benchmarks = await loadBenchmarks(
    options.benchmarksPath,
    options.chosenBenchmarks,
  );

  /** Loop through every iterations */
  for (let iteration = 1; iteration <= options.iterations; iteration++) {
    /** Loop through every test-site and perform the benchmark */
    for (const [testSiteName, testSiteConfig] of testSites) {
      /** Loop through each of the chosen benchmark */
      for (const [
        benchmarkIndex,
        [benchmarkName, benchmark, warmupRounds],
      ] of benchmarks.entries()) {
        Logger.log(
          "debug",
          `Performing iteration '${iteration}' for test-site '${testSiteName}'`,
        );

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          if (attempt > 1)
            Logger.log(
              "warning",
              `Retrying benchmark '${benchmarkName}' for '${testSiteName}' (attempt ${attempt}/${MAX_ATTEMPTS})`,
            );

          /** Start database if necessary */
          let databaseController: ProcessController | undefined = undefined;
          let serverController: ProcessController | undefined = undefined;

          try {
            if (DATABASE_CONFIG) {
              if (DATABASE_CONFIG.start.regex === undefined)
                throw new Error("Start detection regex required");

              // Prepare the database
              await performDatabaseAction({
                config: DATABASE_CONFIG,
                action: DATABASE_CONFIG.prepare,
                subModulePath: SUBMODULES_PATH,
                processLogLevel: options.processLogLevel,
              });

              databaseController = createProcessController({
                processLogLevel: options.processLogLevel,
                port: DATABASE_CONFIG.port,
                submoduleName: DATABASE_CONFIG.submoduleName,
                config: {
                  start: DATABASE_CONFIG.start.command,
                  startDetectionRegex: DATABASE_CONFIG.start.regex,
                  portIdentifier: "unused",
                },
                ...(options.processEnergyMeasurementPath && {
                  measuringOptions: {
                    processEnergyMeasurementPath:
                      options.processEnergyMeasurementPath,
                    measuringInterval: options.profilerOptions.interval,
                  },
                }),
              });

              await databaseController.waitUntilReady();
            }

            /** Prepare and wait for server */
            serverController = createProcessController({
              processLogLevel: options.processLogLevel,
              port: options.port,
              submoduleName: testSiteName,
              config: testSiteConfig,
              ...(options.processEnergyMeasurementPath && {
                measuringOptions: {
                  processEnergyMeasurementPath:
                    options.processEnergyMeasurementPath,
                  measuringInterval: options.profilerOptions.interval,
                },
              }),
            });

            await serverController.waitUntilReady();

            /** Perform select warmup rounds per benchmark */

            for (
              let warmupRound = 1;
              warmupRound <= warmupRounds + 1;
              warmupRound++
            ) {
              const benchmarkInput: BenchmarkInput = {
                framework: testSiteName,
                iteration,
                warmupRound,
                resultsPath: RESULTS_PATH,
                link: `http://localhost:${options.port}`,
                profilerOptions: options.profilerOptions,
                driverOptions: options.driverOptions,
                setResultPath: {
                  server: serverController.setResultPath,
                  database: databaseController?.setResultPath,
                },
                startMeasurement: {
                  server: serverController.startMeasurement,
                  database: databaseController?.startMeasurement,
                },
                stopMeasurement: {
                  server: serverController.stopMeasurement,
                  database: databaseController?.stopMeasurement,
                },
              };

              Logger.log(
                "info",
                `Benchmarking ${testSiteName} with ${benchmarkName}.. (benchmark ${benchmarkIndex + 1}/${benchmarks.length}) (iteration ${iteration}/${options.iterations}) (round ${warmupRound}/${warmupRounds + 1})`,
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
            // Throw error if it threw during the last attempt
            if (attempt >= MAX_ATTEMPTS) throw error;
          } finally {
            // Terminate server
            if (serverController) {
              await serverController.terminate();
              Logger.log("debug", `Terminated ${testSiteName} server`);
            }

            // Terminate database
            if (databaseController) {
              await databaseController.terminate();
              Logger.log("debug", `Terminated database`);
            }

            /** Reset database if necessary */
            if (DATABASE_CONFIG) {
              Logger.log("debug", `Resetting database`);
              // Prepare the database
              await performDatabaseAction({
                config: DATABASE_CONFIG,
                action: DATABASE_CONFIG.reset,
                subModulePath: SUBMODULES_PATH,
                processLogLevel: options.processLogLevel,
              });
            }
          }
        }
      }
    }

    /** Rotate frameworks for next round */
    testSites = getRotatedTestSites(testSites);
  }
}
