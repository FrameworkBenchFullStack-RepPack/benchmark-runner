import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "url";

import Logger from "./logging";

// The postfix used for benchmark files
const BENCHMARK_FILE_EXTENSION = ".bm.ts";

function addBenchmarkExtension(path: string): string {
  return `${path}${BENCHMARK_FILE_EXTENSION}`;
}
function removeBenchmarkExtension(path: string): string {
  return path.replace(BENCHMARK_FILE_EXTENSION, "");
}

async function loadAndMapFiles<T>(
  dir: string,
  mappingFunc: (_: [fileName: string, file: any]) => T,
  fileFilter?: (fileName: string) => boolean,
) {
  Logger.log("debug", `Loading benchmark files from directory: ${dir}`);

  let files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(BENCHMARK_FILE_EXTENSION));

  Logger.log(
    "debug",
    `Found ${files.length} benchmark file(s) in directory: ${files.join(", ")}`,
  );

  // Filter files if relevant
  if (fileFilter) {
    files = files.filter(fileFilter);
    Logger.log(
      "debug",
      `After filtering, ${files.length} benchmark file(s) remain: ${files.join(", ")}`,
    );
  }

  // Import and process all benchmark files
  const mappedFiles = await Promise.all(
    files.map(async (file) => {
      const fileUrl = pathToFileURL(path.join(dir, file)).href;
      const importedFile = await import(fileUrl);
      return mappingFunc([file, importedFile]);
    }),
  );

  return mappedFiles;
}

/**
 * Function to import all benchmarks from a given directory
 * @param dir Path to the benchmark directory
 * @param benchmarks Optional list of benchmarks to import
 * @returns Default functions exported by the given benchmarks
 */
export async function loadBenchmarks(
  dir: string,
  benchmarks: string[],
): Promise<[string, Function, number][]> {
  // Create filter function if necessary
  const filterFunction = (bmName: string) =>
    benchmarks.includes(removeBenchmarkExtension(bmName));

  // Import filtered benchmarks and make sure they export a default function
  const importedBenchmarks = await loadAndMapFiles(
    dir,
    ([path, importedFile]) => {
      if (!importedFile.WARMUP_ROUNDS)
        Logger.log(
          "warning",
          `Imported benchmark '${removeBenchmarkExtension(path)}', does not export a variable 'WARMUP_ROUNDS' - defaulting to 0.`,
        );

      return [
        removeBenchmarkExtension(path),
        importedFile.default ?? null,
        importedFile.WARMUP_ROUNDS ?? 0,
      ];
    },
    filterFunction,
  );

  // Get the functions
  const functions = importedBenchmarks.filter(
    (bm): bm is [string, Function, number] =>
      typeof bm[1] === "function" && typeof bm[2] === "number",
  );

  if (functions.length !== benchmarks.length) {
    Logger.log(
      "warning",
      `Loaded ${functions.length} of ${benchmarks.length} requested benchmarks - some did not export a default function`,
    );
  } else {
    Logger.log(
      "debug",
      `Loaded ${functions.length} benchmark function(s) successfully`,
    );
  }

  // Return functions in sorted order
  return functions.sort(
    (a, b) => benchmarks.indexOf(a[0]) - benchmarks.indexOf(b[0]),
  );
}

/**
 * Function to get the names of the valid benchmarks in the given directory
 * @param dir Path to the benchmark directory
 * @returns Names of the valid benchmarks in the given directory
 */
export async function getBenchmarkNames(dir: string) {
  // Get names of benchmarks
  const benchmarks = await loadAndMapFiles(dir, ([file, importedFile]) =>
    typeof importedFile.default === "function"
      ? removeBenchmarkExtension(file)
      : null,
  );

  // Return non-null entries
  return benchmarks.filter((f) => f !== null);
}

/**
 * Function to get the names of the valid benchmarks in the given directory
 * @param dir Path to the benchmark directory
 * @returns Names of the valid benchmarks in the given directory
 */
export async function validateBenchmarks(dir: string, benchmarks: string[]) {
  Logger.log(
    "debug",
    `Validating ${benchmarks.length} benchmark(s): ${benchmarks.join(", ")}`,
  );

  // Import and process all benchmarks
  const benchmarkChecks = await Promise.all(
    benchmarks.map(async (bm) => {
      const fileUrl = pathToFileURL(
        path.join(dir, addBenchmarkExtension(bm)),
      ).href;
      const importedFile = await import(fileUrl);
      return typeof importedFile.default === "function" ? true : false;
    }),
  );

  const isValid = !benchmarkChecks.includes(false);
  if (!isValid) {
    Logger.log(
      "warning",
      `One or more benchmarks failed validation - missing a default function export`,
    );
  }

  return isValid;
}
