import { Driver } from "selenium-webdriver/firefox";
import {
  loadPage,
  prepareBrowser,
  profilerWrapper,
  promisifiedTimeout,
} from "../utilities/benchmark-utilities";
import BenchmarkInput from "./benchmark-types";
import Logger from "../utilities/logging";

const BENCHMARK_NAME = "live" as const;

export default async function benchmark(options: BenchmarkInput) {
  Logger.log(
    "debug",
    `Starting '${BENCHMARK_NAME}' benchmark for ${options.framework}`,
  );

  const prepareTest = async (driver: Driver) => {
    await prepareBrowser(driver);
  };

  const performTest = async (driver: Driver) => {
    await loadPage(driver, options.link + "/live/");

    // Let the page run for the 16 seconds it takes to loop through all values.
    Logger.log("debug", "Holding live page for 16s to loop all values");
    await promisifiedTimeout(16000);
  };

  await profilerWrapper({
    ...options,
    benchmarkName: BENCHMARK_NAME,
    performBM: performTest,
    beforeBM: prepareTest,
  });
}
