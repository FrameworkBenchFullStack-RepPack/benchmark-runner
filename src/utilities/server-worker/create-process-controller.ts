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
import Logger, { LogLevel } from "../logging";

const NON_MEASURING_PROCESS_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./regular-process-worker.ts",
);

const MEASURING_PROCESS_WORKER_PATH = path.resolve(
  import.meta.dirname,
  "./measuring-process-worker.ts",
);

export type ProcessController = {
  setResultPath(path: string): void;
  startMeasurement(): void;
  stopMeasurement(): void;
  waitUntilReady(): Promise<void>;
  terminate(): Promise<void>;
};

export function createProcessController(options: {
  processLogLevel: LogLevel;
  port: number;
  measuringOptions?: {
    processEnergyMeasurementPath: string;
    measuringInterval: number;
  };
  submoduleName: string;
  config: TestSiteConfig;
}): ProcessController {
  Logger.log(
    "debug",
    `Creating process controller for ${options.submoduleName}`,
  );

  const isMeasuringProcess = options.measuringOptions !== undefined;
  Logger.log("debug", `Using process-measuring-tool: ${isMeasuringProcess}`);

  const workerPath = isMeasuringProcess
    ? MEASURING_PROCESS_WORKER_PATH
    : NON_MEASURING_PROCESS_WORKER_PATH;

  // Prepare path related config
  const submodulePath = path.join(SUBMODULES_PATH, options.submoduleName);
  const cwd = options.config.start.workingPath(submodulePath);

  // Prepare environment variables
  const env = {
    [options.config.portIdentifier]: options.port.toString(),
    ...(options.config.start.env(submodulePath) ?? {}),
  };

  const workerData: BaseWorkerData | MeasuringWorkerData = {
    logLevel: options.processLogLevel,
    processCommand: options.config.start.command,
    startDetectionRegex: options.config.startDetectionRegex,
    env,
    cwd,
    ...(isMeasuringProcess && {
      processMeasurementExecutable:
        options.measuringOptions?.processEnergyMeasurementPath,
      measurementInterval: options.measuringOptions?.measuringInterval,
    }),
  };

  Logger.log("debug", `Starting worker at: `, workerPath);
  const worker = new Worker(workerPath, {
    workerData,
  });

  const post = <T extends MessageType>(message: MessageStructures[T][0]) => {
    worker.postMessage(message);
  };

  const setResultPath = isMeasuringProcess
    ? (path: string) =>
        post({
          type: MessageType.SetOutputPath,
          payload: {
            path,
          },
        })
    : () => {};

  const startMeasurement = isMeasuringProcess
    ? () => post({ type: MessageType.Start })
    : () => {};

  const stopMeasurement = isMeasuringProcess
    ? () => post({ type: MessageType.Stop })
    : () => {};

  const waitUntilReady = async (): Promise<void> => {
    const onError = (error: Error) => {
      throw error;
    };

    const onExit = (code: number) => {
      throw new Error(`Process worker exited before ready with code ${code}`);
    };

    // Add event listeners for errors and unexpected exists
    worker.once("error", onError);
    worker.once("exit", onExit);

    try {
      Logger.log("debug", "Waiting for process ready message");
      while (true) {
        const [message] = await once(worker, "message");
        Logger.log("debug", "Got ready message from process: ", message);

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
    Logger.log("debug", "Sending terminate message to worker");
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
