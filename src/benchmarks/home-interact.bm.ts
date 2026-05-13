import { Driver } from "selenium-webdriver/firefox";
import {
  loadPage,
  prepareBrowser,
  profilerWrapper,
  scrollToElement,
} from "../utilities/benchmark-utilities";
import BenchmarkInput from "./benchmark-types";
import { testList } from "./elements/list";
import Logger from "../utilities/logging";

const BENCHMARK_NAME = "home-interact" as const;

export default async function benchmark(options: BenchmarkInput) {
  Logger.log(
    "debug",
    `Starting '${BENCHMARK_NAME}' benchmark for ${options.framework}`,
  );

  const prepareTest = async (driver: Driver) => {
    await prepareBrowser(driver);
  };

  const performTest = async (driver: Driver) => {
    await loadPage(driver, options.link);

    await scrollToElement(driver, "#list", 0);
    Logger.log("debug", "Beginning list interactions on home page");
    await testList(driver);
  };

  await profilerWrapper({
    ...options,
    benchmarkName: BENCHMARK_NAME,
    performBM: performTest,
    beforeBM: prepareTest,
  });
}
