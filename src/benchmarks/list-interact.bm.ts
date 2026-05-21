import { Driver } from "selenium-webdriver/firefox";
import {
  loadPage,
  prepareBrowser,
  profilerWrapper,
} from "../utilities/benchmark-utilities";
import BenchmarkInput from "./benchmark-types";
import { testList } from "./elements/list";
import Logger from "../utilities/logging";

const BENCHMARK_NAME = "list-interact" as const;
export const WARMUP_ROUNDS = 6 as const;

export default async function benchmark(options: BenchmarkInput) {
  Logger.log(
    "debug",
    `Starting '${BENCHMARK_NAME}' benchmark for ${options.framework}`,
  );

  const prepareTest = async (driver: Driver) => {
    await prepareBrowser(driver);
  };

  const performTest = async (driver: Driver) => {
    await loadPage(driver, options.link + "/list/");

    Logger.log("debug", "Beginning list interactions on /list page");
    await testList(driver);
  };

  await profilerWrapper({
    ...options,
    benchmarkName: BENCHMARK_NAME,
    performBM: performTest,
    beforeBM: prepareTest,
  });
}
