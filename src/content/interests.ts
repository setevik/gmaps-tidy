// gmaps-tidy content script for google.com/interests/saved*
// Handles two page contexts:
//   Top-level saved page  → scrape list cards (names + detail URLs)
//   List detail page       → scrape place entries + execute move operations

import { INTERESTS_SELECTORS as S } from "@shared/selectors";
import type {
  BackgroundToInterestsMsg,
  ScrapeListsResultMsg,
  MovePlacesResultMsg,
} from "@shared/messages";
import type { MoveOperation, Place, SavedList } from "@shared/types";

// ── Helpers ───────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait for an element matching `selector` to appear in the DOM. */
function waitForSelector(
  selector: string,
  timeoutMs = 10_000,
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for "${selector}"`));
    }, timeoutMs);

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * Scroll a container to the bottom repeatedly until no new items appear,
 * to trigger lazy-loading of all entries.
 */
async function scrollToLoadAll(
  container: Element,
  itemSelector: string,
  maxScrolls = 50,
): Promise<void> {
  let previousCount = 0;
  for (let i = 0; i < maxScrolls; i++) {
    const items = container.querySelectorAll(itemSelector);
    if (items.length === previousCount && i > 0) break;
    previousCount = items.length;
    container.scrollTop = container.scrollHeight;
    await delay(500);
  }
}

/**
 * Find a clickable element (button, li, a, div[role]) whose trimmed
 * visible text matches `text` exactly.
 */
function findClickableByText(text: string): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll(
      'li[role="option"], li[role="menuitem"], div[role="option"], button, a',
    ),
  ) as HTMLElement[];
  for (const el of candidates) {
    if (el.textContent?.trim() === text) {
      return el;
    }
  }
  return null;
}

/** True if the current URL looks like a list detail page. */
function isListDetailPage(): boolean {
  return /\/interests\/saved\/list\/|\/saved\/list\//.test(
    location.pathname,
  );
}

// ── Scrape: top-level saved page ──────────────────────────────────

function scrapeListCards(): ScrapeListsResultMsg {
  const lists: SavedList[] = [];
  const listDetailUrls: Record<string, string> = {};

  const cards = Array.from(
    document.querySelectorAll(S.listContainer),
  ) as HTMLAnchorElement[];
  for (const card of cards) {
    const ariaLabel = card.getAttribute("aria-label");
    if (!ariaLabel) continue;

    const match = S.listAriaLabelRegex.exec(ariaLabel);
    if (!match) continue;

    const name = match[1].trim();
    const countStr = match[2]; // e.g. "5 items" or "99+ items"
    const count = parseInt(countStr, 10) || 0;

    lists.push({ name, placeCount: count, lastSynced: Date.now() });

    // Capture the detail page URL for background-coordinated navigation
    if (card.href) {
      listDetailUrls[name] = card.href;
    }
  }

  return {
    type: "SCRAPE_LISTS_RESULT",
    lists,
    places: [],
    listDetailUrls,
  };
}

// ── Scrape: list detail page ──────────────────────────────────────

async function scrapePlaceEntries(): Promise<ScrapeListsResultMsg> {
  // Determine the current list name from the page heading
  const titleEl = document.querySelector(S.listDetailTitle);
  const listName = titleEl?.textContent?.trim() ?? "Unknown";

  // Scroll to load all lazy-loaded entries
  const container =
    document.querySelector(S.listDataContainer) ?? document.documentElement;
  await scrollToLoadAll(container, S.placeEntry);

  const places: Place[] = [];
  const entries = Array.from(document.querySelectorAll(S.placeEntry));
  for (const entry of entries) {
    const nameEl = entry.querySelector(S.placeName) as HTMLAnchorElement | null;
    if (!nameEl) continue;

    const name =
      nameEl.getAttribute("aria-label") ?? nameEl.textContent?.trim() ?? "";
    const mapsUrl = nameEl.href ?? "";

    if (name && mapsUrl) {
      places.push({
        name,
        mapsUrl,
        listName,
        address: null,
        categories: [],
        status: "unknown",
        lastChecked: null,
      });
    }
  }

  return { type: "SCRAPE_LISTS_RESULT", lists: [], places };
}

// ── Move places ───────────────────────────────────────────────────

async function movePlaces(
  operations: MoveOperation[],
): Promise<MovePlacesResultMsg> {
  const errors: string[] = [];

  for (const op of operations) {
    try {
      // 1. Find the "More options" button for this place
      const moreSelector = `button[aria-label="More options for ${CSS.escape(op.placeName)}"]`;
      const moreBtn = document.querySelector<HTMLElement>(moreSelector);

      if (!moreBtn) {
        errors.push(`Cannot find More-options button for "${op.placeName}"`);
        continue;
      }

      // 2. Open overflow menu
      moreBtn.click();

      let moveItem: HTMLElement | null;
      try {
        moveItem = (await waitForSelector(
          S.menuMoveItemToList,
          3000,
        )) as HTMLElement;
      } catch {
        errors.push(`No overflow menu appeared for "${op.placeName}"`);
        continue;
      }

      // 3. Click "Move to a collection"
      moveItem.click();
      await delay(500);

      // 4. Select the target collection from the picker
      const targetEl = findClickableByText(op.targetList);
      if (!targetEl) {
        errors.push(
          `Target list "${op.targetList}" not found in picker for "${op.placeName}"`,
        );
        // Dismiss the picker
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        await delay(300);
        continue;
      }

      targetEl.click();
      await delay(1000); // allow move animation
    } catch (err) {
      errors.push(`Error moving "${op.placeName}": ${err}`);
    }
  }

  return {
    type: "MOVE_PLACES_RESULT",
    success: errors.length === 0,
    errors,
  };
}

// ── Message listener ──────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (
    message: BackgroundToInterestsMsg,
  ): Promise<ScrapeListsResultMsg | MovePlacesResultMsg> | undefined => {
    switch (message.type) {
      case "SCRAPE_LISTS":
        if (isListDetailPage()) {
          return scrapePlaceEntries();
        }
        return Promise.resolve(scrapeListCards());

      case "MOVE_PLACES":
        return movePlaces(message.operations);

      default:
        return undefined;
    }
  },
);
