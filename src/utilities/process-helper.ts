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
}: {
  command: string;
  cwd: string;
  regex?: string;
  stream?: Stream;
}) {
  return new Promise<void>((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
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
    });
  });
}
