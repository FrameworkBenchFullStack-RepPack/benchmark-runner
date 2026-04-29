import { exec } from "child_process";

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
  return new Promise<void>((resolve, reject) => {
    exec(
      command,
      { cwd, env: { ...env, ...process.env } },
      (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }

        if (
          regex &&
          !new RegExp(regex).test(stream === Stream.stdout ? stdout : stderr)
        ) {
          return reject("Regex did not match stdout");
        }

        resolve();
      },
    );
  });
}
