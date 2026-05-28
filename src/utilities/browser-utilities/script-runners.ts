import { Driver, Context } from "selenium-webdriver/firefox";

import Logger from "../logging";

/**
 * Function to execute JavaScript in the Chrome of Firefox
 * @param driver Driver used to execute script
 * @param script Script to be executed
 * @param name Name of script to be executed
 * @returns The returned value of the script
 */
export async function runScript(
  name: string,
  driver: Driver,
  script: string,
  ...args: any[]
): Promise<string | undefined> {
  try {
    const result = await driver.executeScript(script, ...args);

    return typeof result === "string" ? result : undefined;
  } catch (error) {
    Logger.log(
      "error",
      `Couldn't execute script named ${name}. Error: `,
      error,
    );
    throw error;
  }
}

/**
 * Function to execute JavaScript in the Chrome of Firefox
 * @param driver Driver used to execute script
 * @param script Script to be executed
 * @param name Name of script to be executed
 * @param timeout Max execution time
 * @returns The returned value of the script
 */
export async function runScriptInChrome(
  name: string,
  driver: Driver,
  script: string,
  ...args: any[]
): Promise<string | undefined> {
  const prevContext = await driver.getContext();

  try {
    await driver.setContext(Context.CHROME);
    const result = await runScript(name, driver, script, ...args);
    await driver.setContext(prevContext);
    return result;
  } catch (error) {
    Logger.log("error", `Execution of ${name} failed in the browser chrome`);
    await driver.setContext(prevContext);
    throw error;
  }
}

/**
 * Async script functions
 */

/**
 * Function to execute Async JavaScript in Firefox
 * @param driver Driver used to execute script
 * @param script Script to be executed
 * @param name Name of script to be executed
 * @returns The returned value of the script
 */
export async function runScriptAsync(
  name: string,
  driver: Driver,
  script: string,
  ...args: any[]
): Promise<string | undefined> {
  try {
    const result = await driver.executeAsyncScript(script, ...args);

    return typeof result === "string" ? result : undefined;
  } catch (error) {
    Logger.log(
      "error",
      `Couldn't execute script named ${name}. Error: `,
      error,
    );
    throw error;
  }
}

/**
 * Function to execute Async JavaScript in the Chrome of Firefox
 * @param driver Driver used to execute script
 * @param script Script to be executed
 * @param name Name of script to be executed
 * @returns The returned value of the script
 */
export async function runScriptInChromeAsync(
  name: string,
  driver: Driver,
  script: string,
  ...args: any[]
): Promise<string | undefined> {
  const prevContext = await driver.getContext();

  try {
    await driver.setContext(Context.CHROME);
    const result = await runScriptAsync(name, driver, script, args);
    await driver.setContext(prevContext);
    return result;
  } catch (error) {
    Logger.log(
      "error",
      `Async execution of ${name} failed in the browser chrome`,
    );
    await driver.setContext(prevContext);
    throw error;
  }
}
