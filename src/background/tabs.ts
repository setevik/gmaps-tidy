// Tab management utilities for the background script.
// Provides helpers to find/create tabs and wait for navigation.

const TAB_LOAD_TIMEOUT_MS = 30_000;

/**
 * Find an existing tab whose URL matches any of the given patterns,
 * or create a new tab navigated to `createUrl`.
 */
export async function findOrCreateTab(
  urlPatterns: string[],
  createUrl: string,
): Promise<number> {
  const tabs = await browser.tabs.query({ url: urlPatterns });
  if (tabs.length > 0 && tabs[0].id != null) {
    return tabs[0].id;
  }
  const tab = await browser.tabs.create({ url: createUrl, active: false });
  if (tab.id == null) {
    throw new Error("Failed to create tab");
  }
  return tab.id;
}

/**
 * Wait for a tab to reach `status === "complete"`.
 */
export function waitForTabLoad(
  tabId: number,
  timeoutMs = TAB_LOAD_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab ${tabId} load timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    function listener(
      id: number,
      info: browser.tabs._OnUpdatedChangeInfo,
    ) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    // Check if already loaded before adding listener
    browser.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        clearTimeout(timer);
        resolve();
      } else {
        browser.tabs.onUpdated.addListener(listener);
      }
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Navigate an existing tab to `url` and wait for the page to finish loading.
 */
export function navigateAndWait(
  tabId: number,
  url: string,
  timeoutMs = TAB_LOAD_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab ${tabId} navigation timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    function listener(
      id: number,
      info: browser.tabs._OnUpdatedChangeInfo,
    ) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    browser.tabs.onUpdated.addListener(listener);
    browser.tabs.update(tabId, { url }).catch((err) => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      reject(err);
    });
  });
}
