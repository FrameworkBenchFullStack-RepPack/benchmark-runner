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
import Logger from "../logging.ts";

(async () => {
  const workerConfig: MeasuringWorkerData = workerData;

  Logger.log(
    "debug",
    `Spawning process-measuring-tool: '${workerConfig.processMeasurementExecutable}' wrapping '${workerConfig.serverCommand}' (cwd: ${workerConfig.cwd})`,
  );

  const serverProcess = spawn(
    workerConfig.processMeasurementExecutable,
    [
      `--command=${workerConfig.serverCommand}`,
      `--start-regex=${workerConfig.startDetectionRegex.regex}`,
      `--regex-output-channel=${workerConfig.startDetectionRegex.channel}`,
      `--interval=${workerConfig.measurementInterval}`,
      `--process-dir=${workerConfig.cwd}`,
      `--log-level=${workerConfig.logLevel}`,
    ],
    {
      shell: false,
      env: {
        ...process.env,
        ...workerConfig.env,
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
    Logger.log("error", "Measuring server stderr:", data.toString());
  });

  /* Server process stdout handling */
  serverProcess.stdout.on("data", (data) => {
    try {
      const text = data.toString();
      const json = JSON.parse(text);

      if (!checkIncomingJson(json)) throw new Error("Invalid message");
      switch (json.type) {
        case ProcessMessageTypes.measurement_ready:
          Logger.log(
            "debug",
            "Measurement tool reported ready - signaling ready to parent",
          );
          parentPort?.postMessage(readyMessage);
          break;
      }
    } catch (e) {
      Logger.log(
        "error",
        "Measuring server worker failed while processing output: ",
        e,
      );
    }
  });

  /* Server process close handling */
  serverProcess.on("exit", (code) => {
    Logger.log("debug", `Measuring server process exited with code: ${code}`);
    process.exit(0);
  });

  const sendMessage = (m: string) => {
    serverProcess.stdin.write(m + "\n");
  };

  const terminateServer = () => {
    const terminateServerMessage: ProcessMessage = {
      type: ProcessMessageTypes.terminate,
    };
    sendMessage(JSON.stringify(terminateServerMessage));
  };

  /* Worker communication */
  parentPort?.on("message", async (message) => {
    switch (message?.type) {
      case MessageType.Start:
        Logger.log("debug", "Forwarding Start to measurement tool");
        const startMeasurements: ProcessMessage = {
          type: ProcessMessageTypes.measurement_start,
        };

        sendMessage(JSON.stringify(startMeasurements));
        break;
      case MessageType.Stop:
        Logger.log("debug", "Forwarding Stop to measurement tool");
        const stopMeasurements: ProcessMessage = {
          type: ProcessMessageTypes.measurement_stop,
        };

        sendMessage(JSON.stringify(stopMeasurements));
        break;
      case MessageType.SetOutputPath:
        Logger.log(
          "debug",
          `Forwarding SetOutputPath to measurement tool: ${message.payload.path}`,
        );
        const setOutputPath: ProcessMessage = {
          type: ProcessMessageTypes.set_output_path,
          payload: { path: message.payload.path },
        };

        sendMessage(JSON.stringify(setOutputPath));
        break;
      case MessageType.Terminate:
        Logger.log("debug", "Received Terminate message from parent");
        terminateServer();
        break;
    }
  });

  // If worker is terminated, terminate the server as well
  process.on("SIGTERM", terminateServer);
  process.on("SIGINT", terminateServer);
})();
