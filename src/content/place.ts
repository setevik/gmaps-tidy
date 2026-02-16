// gmaps-tidy content script for google.com/maps/place/*
// Extracts business status, category, and address from rendered DOM.

import type {
  BackgroundToPlaceMsg,
  ScrapePlaceResultMsg,
} from "@shared/messages";
import type { PlaceScrapeResult, PlaceStatus } from "@shared/types";

// ── Place page selectors ──────────────────────────────────────────
// These target the Google Maps place info panel. Selectors use
// aria-labels and data-* attributes where possible for stability.

const PLACE_SEL = {
  /** Address row in the info panel. */
  address: 'button[data-item-id="address"]',
  /** Category button (jsaction-based — the most reliable signal). */
  categoryButton: 'button[jsaction*="pane.rating.category"]',
  /** Fallback: category link that navigates to a search. */
  categoryLink: 'a[jsaction*="pane.rating.category"]',
};

// ── Status detection ──────────────────────────────────────────────

function detectStatus(): PlaceStatus {
  const text = document.body.innerText;

  // Google shows these banners prominently for dead/paused businesses
  if (/permanently\s+closed/i.test(text)) return "permanently_closed";
  if (/temporarily\s+closed/i.test(text)) return "temporarily_closed";

  // If the page has no recognizable place heading, treat as not found
  const heading = document.querySelector("h1");
  if (!heading || !heading.textContent?.trim()) return "not_found";

  return "open";
}

// ── Category extraction ───────────────────────────────────────────

function extractCategories(): string[] {
  // Primary: button/link with jsaction containing "pane.rating.category"
  const el =
    document.querySelector<HTMLElement>(PLACE_SEL.categoryButton) ??
    document.querySelector<HTMLElement>(PLACE_SEL.categoryLink);

  if (el) {
    const raw = el.textContent?.trim() ?? "";
    if (raw) {
      // Categories may be separated by " · " (e.g. "Restaurant · Bar")
      return raw
        .split(/\s*·\s*/)
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }

  return [];
}

// ── Address extraction ────────────────────────────────────────────

function extractAddress(): string | null {
  const el = document.querySelector<HTMLElement>(PLACE_SEL.address);
  if (!el) return null;

  // Prefer aria-label which typically contains the full address
  const label = el.getAttribute("aria-label");
  if (label) {
    return label.replace(/^Address:\s*/i, "").trim() || null;
  }

  return el.textContent?.trim() || null;
}

// ── Main scrape ───────────────────────────────────────────────────

function scrapePlaceData(): PlaceScrapeResult {
  return {
    status: detectStatus(),
    categories: extractCategories(),
    address: extractAddress(),
  };
}

// ── Message listener ──────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (
    message: BackgroundToPlaceMsg,
  ): Promise<ScrapePlaceResultMsg> | undefined => {
    if (message.type === "SCRAPE_PLACE") {
      return Promise.resolve({
        type: "SCRAPE_PLACE_RESULT",
        result: scrapePlaceData(),
      });
    }
    return undefined;
  },
);
