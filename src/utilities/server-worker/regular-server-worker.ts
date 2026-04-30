import { parentPort, workerData } from "worker_threads";
import {
  MessageType,
  type BaseWorkerData,
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
  const workerConfig: BaseWorkerData = workerData;

  const serverProcess = spawn(workerConfig.serverCommand, {
    cwd: workerConfig.siteDir,
    shell: true,
    detached: true,
    env: {
      ...process.env,
      ...workerConfig.env,
    },
  });

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
      const regexp = new RegExp(workerConfig.startDetectionRegex);

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

  const terminateServer = () => {
    if (serverProcess.pid === undefined) {
      logError("Attempted to terminate server but pid is undefined");
      return;
    }

    try {
      // Kill the whole process group.
      process.kill(-serverProcess.pid, "SIGTERM");
    } catch (error: any) {
      if (error.code !== "ESRCH") {
        throw error;
      }

      // Process / process group is already gone.
      return;
    }
  };

  /* Worker communication */
  parentPort?.on("message", async (message) => {
    switch (message?.type) {
      case MessageType.Terminate:
        terminateServer();
        break;
    }
  });

  // If worker is terminated, terminate the server as well
  process.on("SIGTERM", terminateServer);
  process.on("SIGINT", terminateServer);
})();
