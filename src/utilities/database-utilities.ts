import { DatabaseAction, DatabaseConfigType } from "../types/database";
import Logger, { LogLevel } from "./logging";
import { createAsyncProcess } from "./process-helper";
import {
  createProcessController,
  ProcessController,
} from "./server-worker/create-process-controller";

export async function performDatabaseAction({
  config,
  action,
  subModulePath,
  processLogLevel,
}: {
  config: DatabaseConfigType;
  action: DatabaseAction;
  subModulePath: string;
  processLogLevel: LogLevel;
}) {
  if (action.size === 0) return;

  const path = `${subModulePath}/${config.submoduleName}`;

  let databaseProcess: ProcessController | undefined = undefined;

  for (const step of action) {
    if (step === "start-db") {
      if (config.start.regex === undefined)
        throw new Error("Start detection regex required");

      databaseProcess = createProcessController({
        processLogLevel,
        port: config.port,
        submoduleName: config.submoduleName,
        config: {
          start: config.start.command,
          startDetectionRegex: config.start.regex,
          portIdentifier: "unused",
        },
      });

      await databaseProcess.waitUntilReady();
      continue;
    }

    Logger.log("debug", "Preparing database - Executing", step.command);
    await createAsyncProcess({
      command: step.command.command,
      regex: step.regex?.regex,
      env: step.command.env(path),
      cwd: step.command.workingPath(path),
      stream: step.regex?.channel,
    });
  }

  if (databaseProcess !== undefined) await databaseProcess.terminate();
}
