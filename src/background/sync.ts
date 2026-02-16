// Sync lists handler: coordinates scraping across the top-level saved page
// and each list detail page via tab navigation.

import { saveLists, savePlaces } from "@shared/db";
import { sendToTab } from "@shared/messages";
import type { ScrapeListsResultMsg } from "@shared/messages";
import type { Place, SavedList } from "@shared/types";
import { findOrCreateTab, waitForTabLoad, navigateAndWait } from "./tabs";

const INTERESTS_URL_PATTERNS = [
  "*://www.google.com/interests/saved*",
  "*://www.google.com/saved/*",
];
const INTERESTS_URL = "https://www.google.com/interests/saved";

/** Small delay to let content script initialize after page load. */
const CONTENT_SCRIPT_SETTLE_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Multi-step sync:
 *  1. Open the top-level saved page and scrape list cards (names + detail URLs).
 *  2. Navigate to each list's detail page and scrape place entries.
 *  3. Persist everything to IndexedDB.
 */
export async function syncLists(): Promise<SavedList[]> {
  const tabId = await findOrCreateTab(INTERESTS_URL_PATTERNS, INTERESTS_URL);
  await waitForTabLoad(tabId);
  await delay(CONTENT_SCRIPT_SETTLE_MS);

  // Step 1: scrape list cards from the top-level page
  const topLevel = await sendToTab<ScrapeListsResultMsg>(tabId, {
    type: "SCRAPE_LISTS",
  });

  const allPlaces: Place[] = [];
  const detailUrls = topLevel.listDetailUrls ?? {};

  // Step 2: for each list, navigate to its detail page and scrape places
  for (const list of topLevel.lists) {
    const detailUrl = detailUrls[list.name];
    if (!detailUrl) continue;

    await navigateAndWait(tabId, detailUrl);
    await delay(CONTENT_SCRIPT_SETTLE_MS);

    const detail = await sendToTab<ScrapeListsResultMsg>(tabId, {
      type: "SCRAPE_LISTS",
    });

    allPlaces.push(...detail.places);
  }

  // Step 3: persist
  await saveLists(topLevel.lists);
  if (allPlaces.length > 0) {
    await savePlaces(allPlaces);
  }

  return topLevel.lists;
}
