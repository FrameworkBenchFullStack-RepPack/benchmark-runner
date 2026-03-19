import fs from "node:fs";
import path from "node:path";
import { Worker } from "worker_threads";
import { InputOptions } from "../index";
import {
  MessageType,
  type MessageStructures,
} from "./server-worker/worker-types";
import BenchmarkInput from "../benchmarks/benchmark-types";

import { loadBenchmarks } from "./benchmark-file-helper";
import TestSites from "../../test-sites";
import type { TestSiteConfig } from "../types/test-sites";
import { once } from "node:events";

const NON_MEASURING_SERVER_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./server-worker/server-worker.ts",
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
  testSiteConfig: TestSiteConfig,
): ServerController {
  const measuringServer = options.processEnergyMeasurementPath !== undefined;

  const workerPath = measuringServer
    ? MEASURING_SERVER_WORKER_PATH
    : NON_MEASURING_SERVER_WORKER_PATH;

  const worker = new Worker(workerPath, {
    workerData: {
      processMeasurementExecutable: options.processEnergyMeasurementPath,
      measurementInterval: options.profilerOptions.interval,
      serverCommand: testSiteConfig.startCommand,
      startDetectionRegex: testSiteConfig.startDetectionRegex,
      serverPort: options.serverPort,
    },
  });

  const post = <T extends MessageType>(message: MessageStructures[T][0]) => {
    worker.postMessage(message);
  };

  const setResultPath = measuringServer
    ? (path: string) =>
        post({
          type: MessageType.SetOutputPath,
          payload: {
            path,
          },
        })
    : () => {};

  const startMeasurement = measuringServer
    ? () => post({ type: MessageType.Start })
    : () => {};

  const stopMeasurement = measuringServer
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

  /** Make sure the results folder exists */
  if (!fs.existsSync(RESULTS_ROOT)) fs.mkdirSync(RESULTS_ROOT);
  if (!fs.existsSync(RESULTS_PATH)) fs.mkdirSync(RESULTS_PATH);

  /** Determine test-sites to be benchmarked */
  const testSites = options.chosenFrameworks || TestSites;

  /** Loop through every repetitions */
  for (let repetition = 1; repetition <= options.repetitions; repetition++) {
    /** Loop through every test-site and perform the benchmark */
    for (const [testSiteName, testSiteConfig] of Object.entries(testSites)) {
      const server = createServerController(options, testSiteConfig);

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
  }
}
