// Sync lists handler: opens the interests/saved tab, scrapes lists and places,
// and caches results to IndexedDB.

import { saveLists, savePlaces } from "@shared/db";
import { sendToTab } from "@shared/messages";
import type { ScrapeListsResultMsg } from "@shared/messages";
import type { SavedList } from "@shared/types";
import { findOrCreateTab, waitForTabLoad } from "./tabs";

const INTERESTS_URL_PATTERNS = [
  "*://www.google.com/interests/saved*",
  "*://www.google.com/saved/*",
];
const INTERESTS_URL = "https://www.google.com/interests/saved";

/**
 * Open (or reuse) the Google Maps interests tab, scrape all saved lists
 * and their places via the content script, then persist to IndexedDB.
 * Returns the scraped lists.
 */
export async function syncLists(): Promise<SavedList[]> {
  const tabId = await findOrCreateTab(INTERESTS_URL_PATTERNS, INTERESTS_URL);
  await waitForTabLoad(tabId);

  const result = await sendToTab<ScrapeListsResultMsg>(tabId, {
    type: "SCRAPE_LISTS",
  });

  await saveLists(result.lists);
  await savePlaces(result.places);

  return result.lists;
}
