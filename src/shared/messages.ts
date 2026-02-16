import type {
  AuditProgress,
  MoveOperation,
  MoveResult,
  Place,
  PlaceScrapeResult,
  SavedList,
} from "./types";

// ── Popup → Background ─────────────────────────────────────────────

export interface SyncListsMsg {
  type: "SYNC_LISTS";
}

export interface StartAuditMsg {
  type: "START_AUDIT";
  listName: string;
}

export interface PauseAuditMsg {
  type: "PAUSE_AUDIT";
}

export interface ResumeAuditMsg {
  type: "RESUME_AUDIT";
}

export interface GetAuditProgressMsg {
  type: "GET_AUDIT_PROGRESS";
}

export interface ExecuteMovesMsg {
  type: "EXECUTE_MOVES";
  operations: MoveOperation[];
}

// ── Background → Popup (responses / push updates) ──────────────────

export interface SyncListsResultMsg {
  type: "SYNC_LISTS_RESULT";
  lists: SavedList[];
}

export interface AuditProgressMsg {
  type: "AUDIT_PROGRESS";
  progress: AuditProgress;
}

export interface AuditCompleteMsg {
  type: "AUDIT_COMPLETE";
  places: Place[];
}

export interface MoveProgressMsg {
  type: "MOVE_PROGRESS";
  done: number;
  total: number;
}

export interface MoveCompleteMsg {
  type: "MOVE_COMPLETE";
  results: MoveResult;
}

// ── Background → Content (interests page) ──────────────────────────

export interface ScrapeListsMsg {
  type: "SCRAPE_LISTS";
}

export interface ScrapeListsResultMsg {
  type: "SCRAPE_LISTS_RESULT";
  lists: SavedList[];
  places: Place[];
}

export interface MovePlacesMsg {
  type: "MOVE_PLACES";
  operations: MoveOperation[];
}

export interface MovePlacesResultMsg {
  type: "MOVE_PLACES_RESULT";
  success: boolean;
  errors: string[];
}

// ── Background → Content (place page) ──────────────────────────────

export interface ScrapePlaceMsg {
  type: "SCRAPE_PLACE";
}

export interface ScrapePlaceResultMsg {
  type: "SCRAPE_PLACE_RESULT";
  result: PlaceScrapeResult;
}

// ── Error (any direction) ──────────────────────────────────────────

export interface ErrorMsg {
  type: "ERROR";
  error: string;
}

// ── Union types ────────────────────────────────────────────────────

/** Messages the popup sends to the background script. */
export type PopupToBackgroundMsg =
  | SyncListsMsg
  | StartAuditMsg
  | PauseAuditMsg
  | ResumeAuditMsg
  | GetAuditProgressMsg
  | ExecuteMovesMsg;

/** Messages the background sends to the popup (via runtime port or response). */
export type BackgroundToPopupMsg =
  | SyncListsResultMsg
  | AuditProgressMsg
  | AuditCompleteMsg
  | MoveProgressMsg
  | MoveCompleteMsg
  | ErrorMsg;

/** Messages the background sends to the interests content script. */
export type BackgroundToInterestsMsg = ScrapeListsMsg | MovePlacesMsg;

/** Messages the interests content script sends back. */
export type InterestsToBackgroundMsg =
  | ScrapeListsResultMsg
  | MovePlacesResultMsg;

/** Messages the background sends to the place content script. */
export type BackgroundToPlaceMsg = ScrapePlaceMsg;

/** Messages the place content script sends back. */
export type PlaceToBackgroundMsg = ScrapePlaceResultMsg;

/** Any message that can be sent via runtime.sendMessage / tabs.sendMessage. */
export type Message =
  | PopupToBackgroundMsg
  | BackgroundToPopupMsg
  | BackgroundToInterestsMsg
  | InterestsToBackgroundMsg
  | BackgroundToPlaceMsg
  | PlaceToBackgroundMsg
  | ErrorMsg;

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Send a typed message to the background script.
 * Returns the response (if any) from the background listener.
 */
export function sendToBackground<T = unknown>(
  msg: PopupToBackgroundMsg,
): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}

/**
 * Send a typed message to a specific tab's content script.
 */
export function sendToTab<T = unknown>(
  tabId: number,
  msg: BackgroundToInterestsMsg | BackgroundToPlaceMsg,
): Promise<T> {
  return browser.tabs.sendMessage(tabId, msg) as Promise<T>;
}
