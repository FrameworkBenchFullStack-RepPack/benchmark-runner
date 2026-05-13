import { Driver } from "selenium-webdriver/firefox";
import {
  loadPage,
  prepareBrowser,
  profilerWrapper,
  promisifiedTimeout,
} from "../utilities/benchmark-utilities";
import BenchmarkInput from "./benchmark-types";
import Logger from "../utilities/logging";

const BENCHMARK_NAME = "static" as const;

export default async function benchmark(options: BenchmarkInput) {
  Logger.log(
    "debug",
    `Starting '${BENCHMARK_NAME}' benchmark for ${options.framework}`,
  );

  const prepareTest = async (driver: Driver) => {
    await prepareBrowser(driver);
  };

  const performTest = async (driver: Driver) => {
    await loadPage(driver, options.link + "/static-1/");

    // A short visit
    Logger.log("debug", "Holding static page for 500ms");
    await promisifiedTimeout(500);
  };

  await profilerWrapper({
    ...options,
    benchmarkName: BENCHMARK_NAME,
    performBM: performTest,
    beforeBM: prepareTest,
  });
}
