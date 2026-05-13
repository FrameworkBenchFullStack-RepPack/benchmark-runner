import { By, until } from "selenium-webdriver";
import { Driver } from "selenium-webdriver/firefox";
import {
  loadPage,
  pageIsLoaded,
  prepareBrowser,
  profilerWrapper,
  scrollToElement,
  simulateClick,
} from "../utilities/benchmark-utilities";
import BenchmarkInput from "./benchmark-types";
import Logger from "../utilities/logging";

const BENCHMARK_NAME = "navigate" as const;

async function scrollAndNavigate(driver: Driver, hrefSelector: string) {
  Logger.log("debug", `Navigating via footer link to '${hrefSelector}'`);

  // Scroll to footer and open second static page
  await scrollToElement(driver, "footer");

  const linkSelector = `footer a[href*="${hrefSelector}"]`;
  await driver.wait(until.elementLocated(By.css(linkSelector)), 10000);
  const footerLink = await driver.findElement(By.css(linkSelector));
  await simulateClick(driver, footerLink);
}

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

    const navigationPath = [
      "/static-1",
      "/static-2",
      "/live",
      "/list",
      "/live",
      "/static-2",
      "/static-1",
      "/",
    ];

    Logger.log(
      "debug",
      `Walking navigation path of ${navigationPath.length} link(s)`,
    );

    // Scroll to footer and next link in path
    for (const hrefSelector of navigationPath) {
      await scrollAndNavigate(driver, hrefSelector);
      await pageIsLoaded(driver);
    }
    await scrollToElement(driver, "footer");
  };

  await profilerWrapper({
    ...options,
    benchmarkName: BENCHMARK_NAME,
    performBM: performTest,
    beforeBM: prepareTest,
  });
}
