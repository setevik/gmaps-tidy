// Audit orchestrator: manages the place-by-place status-check workflow.
// AuditState is persisted to IndexedDB so it survives event page suspension.
// browser.alarms drives the tick loop.

import {
  getConfig,
  setConfig,
  getPlacesByList,
  getStaleOrUnchecked,
  savePlace,
} from "@shared/db";
import { sendToTab } from "@shared/messages";
import type { ScrapePlaceResultMsg } from "@shared/messages";
import type { AuditProgress, AuditState, Place } from "@shared/types";
import { DEFAULT_AUDIT_CONFIG } from "@shared/config";
import { findOrCreateTab, navigateAndWait } from "./tabs";

export const AUDIT_ALARM = "audit-tick";

const PLACE_URL_PATTERNS = ["*://www.google.com/maps/place/*"];

/** Minimum alarm delay in minutes (~3 seconds). */
const MIN_ALARM_DELAY = 0.05;

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Send an audit progress update to the popup. Silently ignores errors
 * if the popup is closed and nobody is listening.
 */
async function broadcastProgress(progress: AuditProgress): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "AUDIT_PROGRESS",
      progress,
    });
  } catch {
    // Popup not open — nothing to do
  }
}

/**
 * Schedule the next audit tick alarm using the configured delay.
 */
async function scheduleNextTick(): Promise<void> {
  const config = (await getConfig("auditConfig")) ?? DEFAULT_AUDIT_CONFIG;
  const delayMinutes = Math.max(config.delayMs / 60_000, MIN_ALARM_DELAY);
  await browser.alarms.create(AUDIT_ALARM, { delayInMinutes: delayMinutes });
}

/**
 * Build an AuditProgress from the current AuditState, optionally including
 * the name of the place currently being checked.
 */
function progressFromState(
  state: AuditState,
  currentPlaceName: string | null = null,
): AuditProgress {
  return {
    state: state.state,
    current: state.currentIndex,
    total: state.queuedUrls.length,
    currentPlaceName,
  };
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Read the persisted AuditState and return a progress snapshot.
 * Returns an "idle" progress if no audit has been started.
 */
export async function getAuditProgress(): Promise<AuditProgress> {
  const state = await getConfig("auditState");
  if (!state) {
    return { state: "idle", current: 0, total: 0, currentPlaceName: null };
  }
  return progressFromState(state);
}

/**
 * Start a new audit for the given list.
 *
 * 1. Identify places that are stale or never checked.
 * 2. Persist a new AuditState with the queued URLs.
 * 3. Schedule the first alarm tick.
 */
export async function startAudit(listName: string): Promise<void> {
  const config = (await getConfig("auditConfig")) ?? DEFAULT_AUDIT_CONFIG;
  const stale = await getStaleOrUnchecked(listName, config.cacheTtlDays);

  if (stale.length === 0) {
    // Nothing to audit — immediately report "done"
    await setConfig("auditState", null);
    await broadcastProgress({
      state: "done",
      current: 0,
      total: 0,
      currentPlaceName: null,
    });
    return;
  }

  const auditState: AuditState = {
    listName,
    queuedUrls: stale.map((p) => p.mapsUrl),
    currentIndex: 0,
    state: "running",
  };

  await setConfig("auditState", auditState);
  await scheduleNextTick();

  await broadcastProgress(progressFromState(auditState));
}

/**
 * Pause a running audit. Clears the alarm so no further ticks fire.
 */
export async function pauseAudit(): Promise<void> {
  const state = await getConfig("auditState");
  if (!state || state.state !== "running") return;

  state.state = "paused";
  await setConfig("auditState", state);
  await browser.alarms.clear(AUDIT_ALARM);

  await broadcastProgress(progressFromState(state));
}

/**
 * Resume a paused audit. Re-creates the alarm to fire the next tick.
 */
export async function resumeAudit(): Promise<void> {
  const state = await getConfig("auditState");
  if (!state || state.state !== "paused") return;

  state.state = "running";
  await setConfig("auditState", state);
  await scheduleNextTick();

  await broadcastProgress(progressFromState(state));
}

/**
 * Process one place in the audit queue. Called by the alarm handler.
 *
 * 1. Load AuditState from IndexedDB.
 * 2. If done or not running, bail out.
 * 3. Open/navigate a tab to the place URL.
 * 4. Send SCRAPE_PLACE to the content script and collect results.
 * 5. Update the Place record in IndexedDB.
 * 6. Advance the queue index and persist.
 * 7. Schedule the next tick (or broadcast completion).
 */
export async function auditTick(): Promise<void> {
  const state = await getConfig("auditState");
  if (!state || state.state !== "running") return;

  const { queuedUrls, currentIndex, listName } = state;

  // ── Queue exhausted → audit complete ──────────────────────────
  if (currentIndex >= queuedUrls.length) {
    state.state = "done";
    await setConfig("auditState", state);

    const places = await getPlacesByList(listName);

    await broadcastProgress(progressFromState(state));

    try {
      await browser.runtime.sendMessage({
        type: "AUDIT_COMPLETE",
        places,
      });
    } catch {
      // Popup not open
    }
    return;
  }

  // ── Process current place ─────────────────────────────────────
  const url = queuedUrls[currentIndex];
  let placeName: string | null = null;

  try {
    const tabId = await findOrCreateTab(PLACE_URL_PATTERNS, url);
    await navigateAndWait(tabId, url);

    const result = await sendToTab<ScrapePlaceResultMsg>(tabId, {
      type: "SCRAPE_PLACE",
    });

    // Update the place record with scraped data
    const places = await getPlacesByList(listName);
    const place = places.find((p) => p.mapsUrl === url);
    if (place) {
      place.status = result.result.status;
      place.categories = result.result.categories;
      place.address = result.result.address;
      place.lastChecked = Date.now();
      await savePlace(place);
      placeName = place.name;
    }

    // Advance queue
    state.currentIndex = currentIndex + 1;
    state.state = "running";
    await setConfig("auditState", state);

    await broadcastProgress(progressFromState(state, placeName));
  } catch (err) {
    console.error("auditTick error:", err);
    state.state = "error";
    await setConfig("auditState", state);
    await broadcastProgress(progressFromState(state));
    return;
  }

  // Schedule the next tick
  await scheduleNextTick();
}

/**
 * On startup, check if there's a running audit that was interrupted
 * (e.g., browser restart, event page suspension without alarm).
 * If found, re-schedule the alarm to continue.
 */
export async function recoverAuditIfNeeded(): Promise<void> {
  const state = await getConfig("auditState");
  if (!state || state.state !== "running") return;

  // Check if an alarm is already scheduled
  const existing = await browser.alarms.get(AUDIT_ALARM);
  if (existing) return;

  // Re-schedule to resume the audit
  await scheduleNextTick();
  console.log(
    `Recovered audit for "${state.listName}" at index ${state.currentIndex}/${state.queuedUrls.length}`,
  );
}
