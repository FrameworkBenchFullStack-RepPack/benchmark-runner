import { parentPort, workerData } from "worker_threads";
import {
  MessageType,
  type BaseWorkerData,
  type MessageStructures,
} from "./worker-types.ts";
import { spawn } from "child_process";
import { type OutputChannel } from "../../types/test-sites.ts";
import Logger from "../logging.ts";

(async () => {
  const workerConfig: BaseWorkerData = workerData;

  Logger.log(
    "debug",
    `Spawning server process: '${workerConfig.serverCommand}' (cwd: ${workerConfig.cwd})`,
  );

  const serverProcess = spawn(workerConfig.serverCommand, {
    cwd: workerConfig.cwd,
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

  const handleText = (channel: OutputChannel, input: any) => {
    const text = input.toString();
    Logger.log("debug", `Server ${channel}:`, text);

    if (workerConfig.startDetectionRegex.channel === channel) {
      try {
        // Create regex
        const regexp = new RegExp(workerConfig.startDetectionRegex.regex);

        if (regexp.test(text)) {
          Logger.log(
            "debug",
            "Server start regex matched - signaling ready to parent",
          );
          parentPort?.postMessage(readyMessage);
        }
      } catch (e) {
        Logger.log(
          "error",
          "Server worker failed while processing output: ",
          e,
        );
      }
    }
  };

  /* Server process output handling */
  serverProcess.stderr.on("data", (data) => handleText("stderr", data));
  serverProcess.stdout.on("data", (data) => handleText("stdout", data));

  /* Server process close handling */
  serverProcess.on("exit", (code) => {
    Logger.log("debug", `Server process exited with code: ${code}`);
    process.exit(0);
  });

  const sendMessage = (m: string) => {
    serverProcess.stdin.write(m + "\n");
  };

  const terminateServer = () => {
    if (serverProcess.pid === undefined) {
      Logger.log(
        "warning",
        "Attempted to terminate server but pid is undefined",
      );
      return;
    }

    Logger.log(
      "debug",
      `Terminating server process group (pid: ${serverProcess.pid})`,
    );

    try {
      // Kill the whole process group.
      process.kill(-serverProcess.pid, "SIGTERM");
    } catch (error: any) {
      if (error.code !== "ESRCH") {
        Logger.log("error", "Failed to terminate server process: ", error);
        throw error;
      }

      // Process / process group is already gone.
      Logger.log("debug", "Server process group was already gone on terminate");
      return;
    }
  };

  /* Worker communication */
  parentPort?.on("message", async (message) => {
    switch (message?.type) {
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
