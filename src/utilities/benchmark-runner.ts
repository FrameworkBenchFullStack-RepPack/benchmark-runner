import fs from "node:fs";
import path from "node:path";

import * as config from "../../config";
import { Worker } from "worker_threads";

import { InputOptions } from "../index";
import {
  BaseWorkerData,
  MeasuringWorkerData,
  MessageType,
  type MessageStructures,
} from "./server-worker/worker-types";
import BenchmarkInput from "../benchmarks/benchmark-types";

import { loadBenchmarks } from "./benchmark-file-helper";
import type { TestSiteConfig } from "../types/test-sites";
import { once } from "node:events";
import { createAsyncProcess, Stream } from "./process-helper";

const NON_MEASURING_SERVER_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./server-worker/regular-server-worker.ts",
);

const MEASURING_SERVER_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./server-worker/measuring-server-worker.ts",
);

const RESULTS_ROOT = path.resolve(process.cwd(), "profiler-results");
const RESULTS_PATH = path.resolve(
  RESULTS_ROOT,
  String(Math.round(Date.now() / 1000 / 10)),
);

type ServerController = {
  setResultPath(path: string): void;
  startMeasurement(): void;
  stopMeasurement(): void;
  waitUntilReady(): Promise<void>;
  terminate(): Promise<void>;
};

function createServerController(
  options: InputOptions,
  testSiteName: string,
  testSiteConfig: TestSiteConfig,
): ServerController {
  const isMeasuringServer = options.processEnergyMeasurementPath !== undefined;

  const workerPath = isMeasuringServer
    ? MEASURING_SERVER_WORKER_PATH
    : NON_MEASURING_SERVER_WORKER_PATH;

  // Prepare environment variables
  const env = {
    PORT: options.serverPort.toString(),
    ...(config.DatabaseConfig && {
      DATABASE_URL: config.DatabaseConfig.connectionString,
    }),
  };

  // Prepare remaining worker data
  const workerData: BaseWorkerData | MeasuringWorkerData = {
    measurementInterval: options.profilerOptions.interval,
    serverCommand: testSiteConfig.start,
    startDetectionRegex: testSiteConfig.startDetectionRegex,
    serverPort: options.serverPort,
    env,
    siteDir: `${config.SUBMODULES_PATH}/${testSiteName}`,
    ...(isMeasuringServer && {
      processMeasurementExecutable: options.processEnergyMeasurementPath,
    }),
  };

  const worker = new Worker(workerPath, {
    workerData,
  });

  const post = <T extends MessageType>(message: MessageStructures[T][0]) => {
    worker.postMessage(message);
  };

  const setResultPath = isMeasuringServer
    ? (path: string) =>
        post({
          type: MessageType.SetOutputPath,
          payload: {
            path,
          },
        })
    : () => {};

  const startMeasurement = isMeasuringServer
    ? () => post({ type: MessageType.Start })
    : () => {};

  const stopMeasurement = isMeasuringServer
    ? () => post({ type: MessageType.Stop })
    : () => {};

  const waitUntilReady = async (): Promise<void> => {
    const onError = (error: Error) => {
      throw error;
    };

    const onExit = (code: number) => {
      throw new Error(`Server worker exited before ready with code ${code}`);
    };

    // Add event listeners for errors and unexpected exists
    worker.once("error", onError);
    worker.once("exit", onExit);

    try {
      while (true) {
        const [message] = await once(worker, "message");

        if (message?.type === MessageType.Ready) {
          break;
        }
      }
    } finally {
      // Remove event listeners
      worker.off("error", onError);
      worker.off("exit", onExit);
    }
  };

  // Post terminate message and wait for termination
  const terminate = async (): Promise<void> => {
    post({ type: MessageType.Terminate });
    await once(worker, "exit");
  };

  return {
    setResultPath,
    startMeasurement,
    stopMeasurement,
    waitUntilReady,
    terminate,
  };
}

/**
 * Function to perform the benchmark on each test-site
 * @param options Profiler options for the firefox profiler
 * @param port The port to be used to host each test-site
 */
export default async function startBenchmark(options: InputOptions) {
  if (options.processEnergyMeasurementPath)
    console.log("Server process energy measurement enabled");

  /** Start database if necessary */
  if (config.DatabaseConfig) {
    console.log("Starting database");
    await createAsyncProcess({
      command: config.DatabaseConfig.start.command,
      regex: config.DatabaseConfig.start.regex,
      cwd: `${config.SUBMODULES_PATH}/${config.DatabaseConfig.submoduleName}`,
      stream: Stream.stderr,
    });
  }

  /** Make sure the results folder exists */
  if (!fs.existsSync(RESULTS_ROOT)) fs.mkdirSync(RESULTS_ROOT);
  if (!fs.existsSync(RESULTS_PATH)) fs.mkdirSync(RESULTS_PATH);

  /** Determine test-sites to be benchmarked */
  const testSites = options.chosenFrameworks || config.TestSites;

  /** Loop through every repetitions */
  for (let repetition = 1; repetition <= options.repetitions; repetition++) {
    /** Loop through every test-site and perform the benchmark */
    for (const [testSiteName, testSiteConfig] of Object.entries(testSites)) {
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
          console.log(
            `Benchmarking ${testSiteName} with ${benchmarkName}.. (benchmark ${benchmarkIndex + 1}/${benchmarks.length}) (repetition ${repetition}/${options.repetitions})`,
          );
          await benchmark(benchmarkInput);
        }

        console.log("Finished testing and quit browser instance");
      } finally {
        // Terminate server
        await server.terminate();
      }
    }

    /** Reset database if necessary */
    if (config.DatabaseConfig) {
      console.log("Resetting database");
      await createAsyncProcess({
        command: config.DatabaseConfig.reset.command,
        regex: config.DatabaseConfig.reset.regex,
        cwd: `${config.SUBMODULES_PATH}/${config.DatabaseConfig.submoduleName}`,
        stream: Stream.stderr,
      });
    }
  }
}
