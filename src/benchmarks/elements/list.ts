import { By, Select, WebElement } from "selenium-webdriver";
import { Driver } from "selenium-webdriver/firefox";
import {
  promisifiedTimeout,
  simulateClick,
} from "../../utilities/benchmark-utilities";

/**
 * A map corresponding each sort method to the first name in the list if it is sorted correctly.
 */
const sortingToFirstNameMap: string[] = [
  "Aaren Arlette", // name
  "Abbye Lulita", // age
  "Aaren Ernesta", // category
];

/**
 * Waits until the first entry in the list matches one of the specified names.
 *
 * @param driver The driver to control the browser instance.
 * @param names An array of accepted names.
 */
async function firstNameIs(driver: Driver, name: string) {
  return await driver.wait(async () => {
    try {
      const element = await driver.findElement(
        By.css(
          ":is(#list .data, #list-data) tbody > tr:first-of-type > td:first-of-type",
        ),
      );
      return name === (await element.getText());
    } catch (error) {
      console.warn(
        `WARNING: DOM was changed while checking the name of the first list entry, rerunning the check. Cause: ${(error as Error)?.message}`,
      );
      return false;
    }
  }, 5000);
}

/**
 * Waits until none of the entries in the list are older than the specified max age.
 *
 * @param driver The driver to control the browser instance.
 * @param maxAge The maximum age permitted, or null if there should be no entries.
 */
async function maxAgeIs(driver: Driver, maxAge: number | null) {
  return await driver.wait(async () => {
    try {
      const elements = await driver.findElements(
        By.css(
          ":is(#list .data, #list-data) tbody > tr:not([hidden]) > td:nth-of-type(2)",
        ),
      );
      if (maxAge === null || elements.length === 0)
        return maxAge === null && elements.length === 0;
      let maxFoundAge = 0;
      for (const element of elements) {
        const age = Number(await element.getText());
        if (Number.isNaN(age)) {
          throw new Error(
            "Found list entry that did not contain a numerical age entry.",
          );
        }
        maxFoundAge = Math.max(maxFoundAge, age);
      }
      return maxFoundAge <= maxAge;
    } catch (error) {
      console.warn(
        `WARNING: DOM was changed while checking the ages of list entries, rerunning the check. Cause: ${(error as Error)?.message}`,
      );
      return false;
    }
  }, 5000);
}

/**
 * Waits until the number of unique categories present in the list matches the specified amount.
 *
 * @param driver The driver to control the browser instance.
 * @param amount The number of categories that should be present.
 */
async function categoriesPresent(driver: Driver, amount: number) {
  return await driver.wait(async () => {
    try {
      const elements = await driver.findElements(
        By.css(
          ":is(#list .data, #list-data) tbody > tr:not([hidden]) > td:nth-of-type(3)",
        ),
      );
      const categories = new Set();
      for (const element of elements) {
        const category = await element.getText();
        categories.add(category);
      }
      return categories.size === amount;
    } catch (error) {
      console.warn(
        `WARNING: DOM was changed while checking the categories of list entries, rerunning the check. Cause: ${(error as Error)?.message}`,
      );
      return false;
    }
  }, 5000);
}

export async function testList(driver: Driver) {
  await promisifiedTimeout(800);

  // Change sorting strategy
  const selectElement = await driver.findElement(By.css("#list select"));
  const selectInstance = new Select(selectElement);
  for (const index of [1, 2, 0]) {
    await selectInstance.selectByIndex(index);
    await promisifiedTimeout(800);
    await firstNameIs(driver, sortingToFirstNameMap[index]!);
  }

  /** Age Input Field */
  const ageToElement = await driver.findElement(
    By.css(`#list input[name="age_to"]`),
  );

  for (const maxAge of [70, 60, 50, 40, 30, 20, 10, 30, 40, 50, 60, 70]) {
    await ageToElement.clear();
    await ageToElement.sendKeys(maxAge);
    await promisifiedTimeout(700);
    await maxAgeIs(driver, maxAge === 10 ? null : maxAge);
  }

  // Reset input
  await ageToElement.clear();
  await ageToElement.sendKeys(100);

  const pagingSizeElement = await driver.findElement(
    By.css(`#list input[name="size"]`),
  );
  if (Number.parseInt(await pagingSizeElement.getAttribute("value")) < 9) {
    await pagingSizeElement.clear();
    await pagingSizeElement.sendKeys(9);
  }

  /** Category Input Fields */
  const categoryInputElements = await driver.findElements(
    By.css(`#list input[name="category"]`),
  );

  let categories = 4;

  // Disable all categories
  for (const element of categoryInputElements) {
    await simulateClick(driver, element);
    categories--;
    await promisifiedTimeout(200);
    await categoriesPresent(driver, categories === 0 ? 4 : categories);
  }

  // Enable all categories
  for (const element of categoryInputElements) {
    await simulateClick(driver, element);
    categories++;
    await promisifiedTimeout(200);
    await categoriesPresent(driver, categories);
  }
}
