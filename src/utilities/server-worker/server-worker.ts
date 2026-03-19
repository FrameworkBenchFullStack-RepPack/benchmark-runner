import { parentPort, workerData } from "worker_threads";
import {
  MessageType,
  type WorkerData,
  type MessageStructures,
  checkIncomingJson,
  ProcessMessageTypes,
  type ProcessMessage,
} from "./worker-types.ts";
import { spawn } from "child_process";

const logError = (...args: string[]) => {
  console.error("Server worker error - ,", ...args);
};

(async () => {
  const data: WorkerData = workerData;
  const serverProcess = spawn(data.serverCommand, { shell: true });

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
      // Parse text and create regex
      const text = data.toString();
      const regexp = new RegExp(data.startDetectionRegex);

      if (regexp.test(text)) parentPort?.postMessage(readyMessage);
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
      case MessageType.Terminate:
        const terminateProcess: ProcessMessage = {
          type: ProcessMessageTypes.terminate,
        };

        sendMessage(JSON.stringify(terminateProcess));
        break;
    }
  });
})();
