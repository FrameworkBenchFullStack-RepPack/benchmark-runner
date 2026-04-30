import path from "node:path";
import { once } from "node:events";

import { SUBMODULES_PATH } from "../../../config";
import type { TestSiteConfig } from "../../types/test-sites";
import type { InputOptions } from "../../index";

import { Worker } from "worker_threads";
import {
  BaseWorkerData,
  MeasuringWorkerData,
  MessageType,
  type MessageStructures,
} from "./worker-types";

const NON_MEASURING_SERVER_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./regular-server-worker.ts",
);

const MEASURING_SERVER_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./measuring-server-worker.ts",
);

type ServerController = {
  setResultPath(path: string): void;
  startMeasurement(): void;
  stopMeasurement(): void;
  waitUntilReady(): Promise<void>;
  terminate(): Promise<void>;
};

export function createServerController(
  options: InputOptions,
  testSiteName: string,
  testSiteConfig: TestSiteConfig,
): ServerController {
  const isMeasuringServer = options.processEnergyMeasurementPath !== undefined;

  const workerPath = isMeasuringServer
    ? MEASURING_SERVER_WORKER_PATH
    : NON_MEASURING_SERVER_WORKER_PATH;

  // Prepare path related config
  const submodulePath = path.join(SUBMODULES_PATH, testSiteName);
  const cwd = testSiteConfig.start.workingPath(submodulePath);

  // Prepare environment variables
  const env = {
    [testSiteConfig.portIdentifier]: options.serverPort.toString(),
    ...(testSiteConfig.start.env(submodulePath) ?? {}),
  };

  const workerData: BaseWorkerData | MeasuringWorkerData = {
    logLevel: options.logLevel,
    measurementInterval: options.profilerOptions.interval,
    serverCommand: testSiteConfig.start.command,
    startDetectionRegex: testSiteConfig.startDetectionRegex,
    serverPort: options.serverPort,
    env,
    cwd,
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
