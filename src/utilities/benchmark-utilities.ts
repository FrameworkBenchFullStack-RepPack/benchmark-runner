import { By, until, WebElement } from "selenium-webdriver";
import { Driver } from "selenium-webdriver/firefox";
import {
  BuilderOptions,
  buildWebDriver,
} from "./browser-utilities/driver-builder";
import ProfilerHandler, {
  ProfilerOptions,
} from "./browser-utilities/profiler-helper";
import { runScript } from "./browser-utilities/script-runners";

interface ProfilerWrapperOptions {
  /** Name of the benchmark */
  benchmarkName: string;

  /** Framework to be tested */
  framework: string;

  /** Current repetition */
  repetition: number;

  /** Results path */
  resultsPath: string;

  /** options for the profiler */
  profilerOptions: ProfilerOptions;

  /** Options for the driver builder */
  driverOptions?: BuilderOptions;

  /**
   * Browser automation function to be benchmarked
   * @param driver Webdriver instance for the automation
   * @returns A Promise<void>
   */
  performBM: (driver: Driver) => Promise<void>;

  /**
   * Browser automation function to prepare the browser for benchmarking
   * @param driver Webdriver instance for the automation
   * @returns A Promise<void>
   */
  beforeBM?: (driver: Driver) => Promise<void>;

  /**
   * Browser automation function to clean up browser after benchmark
   * @param driver Webdriver instance for the automation
   * @returns A Promise<void>
   */
  afterBM?: (driver: Driver) => Promise<void>;

  /**
   * Callback function to set result output path in measuring tool
   * @returns void
   */
  setServerResultPath: (path: string) => void;

  /**
   * Callback function to start energy measurement of the backend server
   * @returns void
   */
  startServerMeasurement: () => void;

  /**
   * Callback function to stop energy measurement of the backend server
   * @returns void
   */
  stopServerMeasurement: () => void;
}

/**
 * Benchmark helper function that facilitates preparing browser, performing benchmark and cleaning up after benchmark.
 * @param {ProfilerWrapperOptions} input See {@link ProfilerWrapperOptions} for details
 */
export async function profilerWrapper(input: ProfilerWrapperOptions) {
  const driver = await buildWebDriver(input.driverOptions);

  if (!driver) {
    throw new Error("Failed to initialize Driver");
  }

  const geckoOutputPath = `${input.resultsPath}/${input.benchmarkName}_${input.framework}_${input.repetition}.json`;
  const serverOutputPath = `${input.resultsPath}/${input.benchmarkName}_${input.framework}_${input.repetition}_server.csv`;

  try {
    // Before benchmark / set server measurement output path
    input.setServerResultPath(serverOutputPath);
    if (input.beforeBM) await input.beforeBM(driver);

    // Configure and start profiler and server measurements
    const profilerHandler = new ProfilerHandler(driver);
    input.startServerMeasurement();
    await profilerHandler.start(input.profilerOptions);

    // Run benchmark
    await input.performBM(driver);

    // Stop profiler and server and store data
    input.stopServerMeasurement();
    await profilerHandler.end(geckoOutputPath);

    // Clean up after the test
    if (input.afterBM) await input.afterBM(driver);
  } finally {
    // Always quit safely
    try {
      await driver.quit();
    } catch (quitErr) {
      // Ignore session errors on quit
      if (
        quitErr instanceof Error &&
        !quitErr.message.includes("NoSuchSessionError")
      ) {
        console.error("Error quitting driver:", quitErr);
      }
    }
  }
}

/**
 * Function that promisifies timeouts
 * @param timeout Timeout in milliseconds
 */
export async function promisifiedTimeout(timeout: number): Promise<void> {
  await new Promise<void>((resolve, _) => setTimeout(resolve, timeout));
}

/**
 * Prepare the browser for testing by fullscreening and deleting cookies
 * @param driver The driver to control the browser instance
 */
export async function prepareBrowser(driver: Driver) {
  await driver.manage().window().fullscreen();
  await driver.manage().deleteAllCookies();
}

/**
 * Navigate to page and wait until the page is loaded.
 *
 * Uses the `pageIsLoaded` utility to wait for page load.
 *
 * @param driver The driver to control the browser instance
 * @param link The link that should be navigated to
 */
export async function loadPage(driver: Driver, link: string) {
  await driver.navigate().to(link);
  await pageIsLoaded(driver);
}

/**
 * Wait until the page is loaded.
 *
 * This will wait for the top of the page's DOM to load, but will not wait for the rest of the page to load,
 * as it might be lazy-loaded and thus will never load unless it is scrolled into view.
 *
 * @param driver The driver to control the browser instance
 */
export async function pageIsLoaded(driver: Driver) {
  await driver.wait(until.elementLocated(By.css("h1")), 10000);
  await driver.wait(until.elementLocated(By.css("main p")), 10000);
}

/**
 * Finds all elements that match a query and returns them along with their index position on the page.
 * Ensures that the returned element is always a valid connected element that is scrolled into the viewport.
 *
 * @param driver The driver to control the browser instance.
 * @param selector The query to select elements with.
 */
export async function* traverseElements(
  driver: Driver,
  selector: string,
): AsyncGenerator<[number, WebElement]> {
  let index = 0;
  let length = 1;
  while (index < length) {
    await scrollToElement(driver, selector, index);
    let element: WebElement;
    try {
      const elements = await driver.findElements(By.css(selector));
      if (elements.length === 0) {
        throw new Error(`Selector did not match any elements.`);
      }
      const candidate = elements[index];
      if (!candidate) {
        throw new Error(`Element disappeared after scrolling to it.`);
      }
      if (!(await candidate.isDisplayed())) {
        throw new Error(`Element is not displayed despite scrolling to it.`);
      }
      element = candidate;
      length = elements.length;
    } catch (error) {
      console.warn(
        `WARNING: DOM was changed after scrolling to a new element with selector "${selector}" at index ${index}, retrying selction of the new element. Cause: ${(error as Error)?.message}`,
      );
      continue;
    }
    yield [index, element];
    index++;
  }
}

/**
 * Scroll to the first element matching the given query selector
 * @param driver The driver to control the browser instance
 * @param querySelector Query selector for the element to scroll to
 */
export async function scrollToElement(
  driver: Driver,
  querySelector: string,
  elementIndex?: number,
) {
  const script = `
    return new Promise(resolve => {
      const elem = ${elementIndex ? `document.querySelectorAll(arguments[0])[${elementIndex}]` : `document.querySelector(arguments[0])`};
      if (!elem) {
        throw new Error("Selector did not match any element: " + arguments[0]);
      }
      if (elem.getBoundingClientRect().bottom < window.innerHeight) {
        resolve();
      } else {
        document.addEventListener("scrollend", () => resolve(), { once: true });
        elem.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    })`;
  await runScript("SCROLL-TO-ELEMENT", driver, script, querySelector);
}

/**
 * Simulate a real click by hovering over the button before clicking.
 * @param driver The driver to control the browser instance
 * @param element Clickable element to be clicked
 */
export async function simulateClick(driver: Driver, element: WebElement) {
  // Hover over element before clicking
  await driver
    .actions({ async: true })
    .move({ origin: element, duration: 500 })
    .perform();
  await promisifiedTimeout(300);
  await element.click();
  await promisifiedTimeout(100);
}
