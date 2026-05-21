import { exec } from "child_process";

import Logger from "./logging";

export enum Stream {
  stderr,
  stdout,
}

export async function createAsyncProcess({
  command,
  cwd,
  regex,
  stream = Stream.stdout,
  env,
}: {
  command: string;
  cwd: string;
  regex?: string;
  stream?: Stream;
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
          !new RegExp(regex).test(stream === Stream.stdout ? stdout : stderr)
        ) {
          Logger.log(
            "error",
            `Regex '${regex}' did not match ${stream === Stream.stdout ? "stdout" : "stderr"} for command: '${command}'`,
          );
          return reject("Regex did not match stdout");
        }

        Logger.log("debug", `Command completed successfully: '${command}'`);
        resolve();
      },
    );
  });
}
