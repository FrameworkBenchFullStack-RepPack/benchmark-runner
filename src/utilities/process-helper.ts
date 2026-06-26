import { exec } from "child_process";

import Logger from "./logging";
import { OutputChannel } from "../types/test-sites";

export async function createAsyncProcess({
  command,
  cwd,
  regex,
  stream = "stdout",
  env,
}: {
  command: string;
  cwd: string;
  regex?: string;
  stream?: OutputChannel;
  env?: { [key: string]: string };
}) {
  Logger.log("debug", `Executing command: '${command}' (cwd: ${cwd})`);

  return new Promise<void>((resolve, reject) => {
    exec(
      command,
      { cwd, env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        if (error) {
          Logger.log(
            "error",
            `Command failed: '${command}' (cwd: ${cwd}) - ${error.message}`,
          );
          return reject(error);
        }

        if (
          regex &&
          !new RegExp(regex).test(stream === "stdout" ? stdout : stderr)
        ) {
          Logger.log(
            "error",
            `Regex '${regex}' did not match ${stream === "stdout" ? "stdout" : "stderr"} for command: '${command}'`,
          );
          return reject("Regex did not match stdout");
        }

        Logger.log("debug", `Command completed successfully: '${command}'`);
        resolve();
      },
    );
  });
}
