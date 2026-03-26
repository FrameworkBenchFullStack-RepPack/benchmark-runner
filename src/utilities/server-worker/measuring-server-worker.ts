import { parentPort, workerData } from "worker_threads";
import {
  MessageType,
  type MeasuringWorkerData,
  type MessageStructures,
  checkIncomingJson,
  ProcessMessageTypes,
  type ProcessMessage,
} from "./worker-types.ts";
import { spawn } from "child_process";

const logError = (...args: string[]) => {
  console.error(...args);
};

(async () => {
  const data: MeasuringWorkerData = workerData;

  const serverProcess = spawn(
    data.processMeasurementExecutable,
    [
      `--command=${data.serverCommand}`,
      `--start-regex=${data.startDetectionRegex}`,
      `--interval=${data.measurementInterval}`,
      `--process-dir=${data.siteDir}`,
    ],
    {
      shell: false,
      env: {
        ...process.env,
        ...data.env,
      },
    },
  );

  const readyMessage: MessageStructures[typeof MessageType.Ready][0] = {
    type: MessageType.Ready,
    payload: {
      message: `Server process ready`,
    },
  };

  serverProcess.stderr.on("data", (data) => {
    logError("stderr:", data.toString());
  });

  /* Server process stdout handling */
  serverProcess.stdout.on("data", (data) => {
    try {
      const text = data.toString();
      const json = JSON.parse(text);

      if (!checkIncomingJson(json)) throw new Error("Invalid message");
      switch (json.type) {
        case ProcessMessageTypes.measurement_ready:
          parentPort?.postMessage(readyMessage);
          break;
      }
    } catch (e) {
      console.error("Process worker threw with: ", e);
    }
  });

  /* Server process close handling */
  serverProcess.on("exit", () => {
    process.exit(0);
  });

  const sendMessage = (m: string) => {
    serverProcess.stdin.write(m + "\n");
  };

  /* Worker communication */
  parentPort?.on("message", async (message) => {
    switch (message?.type) {
      case MessageType.Start:
        const startMeasurements: ProcessMessage = {
          type: ProcessMessageTypes.measurement_start,
        };

        sendMessage(JSON.stringify(startMeasurements));
        break;
      case MessageType.Stop:
        const stopMeasurements: ProcessMessage = {
          type: ProcessMessageTypes.measurement_stop,
        };

        sendMessage(JSON.stringify(stopMeasurements));
        break;
      case MessageType.SetOutputPath:
        const setOutputPath: ProcessMessage = {
          type: ProcessMessageTypes.set_output_path,
          payload: { path: message.payload.path },
        };

        sendMessage(JSON.stringify(setOutputPath));
        break;
      case MessageType.Terminate:
        const terminateProcess: ProcessMessage = {
          type: ProcessMessageTypes.terminate,
        };

        sendMessage(JSON.stringify(terminateProcess));
        break;
    }
  });
})();
