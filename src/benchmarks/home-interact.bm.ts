import { Driver } from "selenium-webdriver/firefox";
import {
  loadPage,
  prepareBrowser,
  profilerWrapper,
  scrollToElement,
} from "../utilities/benchmark-utilities";
import BenchmarkInput from "./benchmark-types";
import { testList } from "./elements/list";

const BENCHMARK_NAME = "subpage-home" as const;

export default async function benchmark(options: BenchmarkInput) {
  const prepareTest = async (driver: Driver) => {
    await prepareBrowser(driver);
  };

  const performTest = async (driver: Driver) => {
    await loadPage(driver, options.link);

    await scrollToElement(driver, "#list", 0);
    await testList(driver);
  };

  await profilerWrapper({
    ...options,
    benchmarkName: BENCHMARK_NAME,
    performBM: performTest,
    beforeBM: prepareTest,
  });
}
