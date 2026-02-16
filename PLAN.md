# Implementation Plan: `gmaps-tidy` Firefox Extension

## Phase 0: Project Scaffolding

### 0.1 — Initialize project structure

Create the following directory layout:

```
gmaps-tidy/
├── manifest.json              # Firefox Manifest V2
├── package.json               # npm config (TS, build tooling)
├── tsconfig.json              # TypeScript config
├── webpack.config.js          # Bundle background, content scripts, popup
├── .gitignore
├── src/
│   ├── background/
│   │   └── index.ts           # Background script entry
│   ├── content/
│   │   ├── interests.ts       # Content script for google.com/interests/saved
│   │   └── place.ts           # Content script for google.com/maps/place/*
│   ├── popup/
│   │   ├── index.html         # Popup shell
│   │   ├── index.ts           # Popup entry (Preact)
│   │   ├── App.tsx            # Root component
│   │   └── components/        # UI components (later phases)
│   ├── shared/
│   │   ├── types.ts           # Shared TypeScript types/interfaces
│   │   ├── messages.ts        # Message type definitions & helpers
│   │   ├── db.ts              # IndexedDB wrapper (idb)
│   │   ├── selectors.ts       # All Google DOM selectors in one place
│   │   └── config.ts          # Default config constants
│   └── options/
│       ├── index.html         # Options page shell
│       └── index.ts           # Category mapping config UI
└── test/
    └── ...                    # Unit tests (later)
```

### 0.2 — Configuration files

**`manifest.json`** (Manifest V2):
- `background.scripts`: bundled background script
- `content_scripts`: two entries — one for `interests/saved`, one for `maps/place/*`
- `browser_action.default_popup`: popup HTML
- `options_ui.page`: options HTML
- `permissions`: `tabs`, `storage`, `activeTab`
- `host_permissions` (as `permissions` in MV2): `https://www.google.com/interests/*`, `https://www.google.com/maps/place/*`, `https://www.google.com/saved/*`

**`package.json`** dependencies:
- `typescript`, `webpack`, `webpack-cli`, `ts-loader`
- `preact` (popup UI)
- `idb` (IndexedDB wrapper)
- Dev: `@types/firefox-webext-browser`, `copy-webpack-plugin`

**`tsconfig.json`**:
- `target: ES2020`, `module: ES2020`, `strict: true`
- `jsxFactory: "h"`, `jsxFragmentFactory: "Fragment"` (Preact)
- `paths` alias for `@shared/*` → `src/shared/*`

### 0.3 — Build pipeline (webpack)

- 4 entry points: `background`, `content/interests`, `content/place`, `popup`
- `copy-webpack-plugin` copies `manifest.json`, HTML files, icons
- Output to `dist/` directory
- `npm run build` produces loadable extension in `dist/`
- `npm run dev` does watch-mode rebuild

---

## Phase 1: Shared Foundation (`src/shared/`)

### 1.1 — Types (`types.ts`)

Define all core interfaces:

```ts
interface SavedList {
  name: string;
  placeCount: number;
  lastSynced: number | null;
}

interface Place {
  name: string;
  mapsUrl: string;
  listName: string;
  address: string | null;
  categories: string[];
  status: 'unknown' | 'open' | 'permanently_closed' | 'temporarily_closed' | 'not_found';
  lastChecked: number | null;
}

interface CategoryMapping {
  categories: string[];  // Google Maps categories that match
  targetList: string;    // Target list name
}

interface MoveOperation {
  placeName: string;
  mapsUrl: string;
  sourceList: string;
  targetList: string;
}

interface MoveLogEntry extends MoveOperation {
  executedAt: number;
  success: boolean;
}

interface AuditConfig {
  delayMs: number;        // Default: 2000
  cacheTtlDays: number;   // Default: 30
}

interface AuditProgress {
  state: 'idle' | 'running' | 'paused' | 'done' | 'error';
  current: number;
  total: number;
  currentPlaceName: string | null;
}
```

### 1.2 — Message protocol (`messages.ts`)

Define typed messages between background ↔ content scripts ↔ popup:

| Message | Direction | Payload |
|---|---|---|
| `SYNC_LISTS` | popup → background | — |
| `SYNC_LISTS_RESULT` | background → popup | `SavedList[]` |
| `START_AUDIT` | popup → background | `{ listName: string }` |
| `AUDIT_PROGRESS` | background → popup | `AuditProgress` |
| `AUDIT_COMPLETE` | background → popup | `Place[]` |
| `PAUSE_AUDIT` | popup → background | — |
| `RESUME_AUDIT` | popup → background | — |
| `EXECUTE_MOVES` | popup → background | `MoveOperation[]` |
| `MOVE_PROGRESS` | background → popup | `{ done: number, total: number }` |
| `SCRAPE_LISTS` | background → content (interests) | — |
| `SCRAPE_LISTS_RESULT` | content → background | `SavedList[], Place[]` |
| `SCRAPE_PLACE` | background → content (place) | — |
| `SCRAPE_PLACE_RESULT` | content → background | `{ status, categories, address }` |
| `MOVE_PLACES` | background → content (interests) | `MoveOperation[]` |
| `MOVE_PLACES_RESULT` | content → background | `{ success: boolean, errors: string[] }` |

Use a discriminated union with a `type` field. Provide `sendMessage()` and `onMessage()` typed helpers.

### 1.3 — IndexedDB layer (`db.ts`)

Using `idb` library:

- DB name: `gmaps-tidy`, version 1
- Object stores:
  - `lists` — keyPath: `name`
  - `places` — keyPath: `mapsUrl`, indexes on `listName`, `status`, `lastChecked`
  - `moveLog` — autoIncrement, indexes on `executedAt`, `sourceList`
  - `config` — keyPath: `key` (stores category mappings, audit settings)
- Expose typed CRUD functions:
  - `getLists()`, `saveLists(lists)`
  - `getPlacesByList(listName)`, `savePlace(place)`, `getStaleOrUnchecked(listName, ttlDays)`
  - `logMove(entry)`, `getMoveLog()`
  - `getConfig(key)`, `setConfig(key, value)`

### 1.4 — Selectors module (`selectors.ts`)

All Google DOM selectors isolated here for easy updates when Google changes their UI:

```ts
export const INTERESTS_SELECTORS = {
  listContainer: '...', // selector for list items on interests/saved
  listName: '...',
  listPlaceCount: '...',
  placeEntry: '...',
  placeName: '...',
  placeUrl: '...',
  placeAddress: '...',
  moveCheckbox: '...',
  moveToCollectionButton: '...',
  targetListOption: '...',
};

export const PLACE_SELECTORS = {
  businessStatus: '...',     // "Permanently closed" text
  placeCategory: '...',      // Category/type label
  placeAddress: '...',       // Full address
  notFoundIndicator: '...',  // Indicator that place wasn't found
};
```

**Note:** Actual selectors require manual inspection of Google's current DOM. These will be placeholder strings initially and must be filled in through manual testing with the extension loaded in Firefox. This is the most fragile part of the extension and is expected to need periodic updates.

### 1.5 — Default config (`config.ts`)

```ts
export const DEFAULT_DELAY_MS = 2000;
export const DEFAULT_CACHE_TTL_DAYS = 30;
export const DEFAULT_CATEGORY_MAPPINGS: CategoryMapping[] = [
  { categories: ['Restaurant'], targetList: 'Wishlist / Restaurants' },
  { categories: ['Bakery'], targetList: 'Wishlist / Bakeries' },
  { categories: ['Café', 'Coffee shop'], targetList: 'Wishlist / Cafés' },
  { categories: ['Bar'], targetList: 'Wishlist / Bars' },
  { categories: ['Museum', 'Art gallery'], targetList: 'Wishlist / Culture' },
];
export const DEFAULT_FALLBACK_LIST = 'Wishlist / Other';
```

---

## Phase 2: Background Script (`src/background/index.ts`)

### 2.1 — Message router

Listen for messages from popup and content scripts. Dispatch to handler functions based on message type.

### 2.2 — Sync lists handler

On `SYNC_LISTS`:
1. Find or open a tab at `https://www.google.com/interests/saved`.
2. Send `SCRAPE_LISTS` message to that tab's content script.
3. Receive `SCRAPE_LISTS_RESULT`, persist to IndexedDB.
4. Reply to popup with `SYNC_LISTS_RESULT`.

### 2.3 — Audit orchestrator

On `START_AUDIT { listName }`:
1. Load places for `listName` from IndexedDB.
2. Filter out places where `lastChecked` is within TTL (skip recently-verified).
3. For each remaining place, sequentially:
   a. Create a tab: `browser.tabs.create({ url: place.mapsUrl, active: false })`.
   b. Wait for tab to finish loading (`browser.tabs.onUpdated` listener).
   c. Send `SCRAPE_PLACE` to the tab's content script.
   d. Receive `SCRAPE_PLACE_RESULT`, update place in IndexedDB.
   e. Close the tab.
   f. Wait `delayMs` before next place.
   g. Send `AUDIT_PROGRESS` to popup.
4. On completion, send `AUDIT_COMPLETE` with all place data.

State machine for pause/resume:
- `PAUSE_AUDIT` sets a flag; the loop checks this flag between iterations.
- `RESUME_AUDIT` clears the flag and the loop continues.

### 2.4 — Move executor

On `EXECUTE_MOVES`:
1. Group moves by `targetList`.
2. Open/find the interests/saved tab.
3. For each target list group, send `MOVE_PLACES` to content script with the batch.
4. Content script performs the moves and reports back.
5. Log each move to IndexedDB `moveLog`.
6. Send progress updates to popup.

---

## Phase 3: Content Scripts

### 3.1 — Interests page content script (`content/interests.ts`)

Injected on `https://www.google.com/interests/saved*`.

**On `SCRAPE_LISTS` message:**
1. Wait for page to fully render (MutationObserver or polling).
2. Query DOM for list containers using `INTERESTS_SELECTORS`.
3. For each list: extract name, place count.
4. For each place entry within lists: extract name, Maps URL, address snippet.
5. Return `SCRAPE_LISTS_RESULT`.

**On `MOVE_PLACES` message:**
1. Navigate to the source list within the page.
2. Wait for place entries to render.
3. For each place in the batch:
   a. Find the place entry by name/URL match.
   b. Click the checkbox to select it.
4. Click "Move to collection" button.
5. Select the target list from the dropdown/dialog.
6. Confirm the move.
7. Wait for the UI to update.
8. Return `MOVE_PLACES_RESULT` with success/failure details.

**DOM interaction helpers** (in this file):
- `waitForSelector(selector, timeout)` — polls/observes until element appears.
- `clickElement(el)` — dispatches click event.
- `scrollIntoView(el)` — ensures element is visible before interaction.

### 3.2 — Place page content script (`content/place.ts`)

Injected on `https://www.google.com/maps/place/*`.

**On `SCRAPE_PLACE` message (or auto-run on load):**
1. Wait for the place detail panel to render.
2. Extract:
   - **Business status**: Look for "Permanently closed" or "Temporarily closed" text in the status area. If not present, assume "open". If page redirected to search results (no place panel), report "not_found".
   - **Category**: Read the category/type text (e.g., "Restaurant", "Bakery") from the place header area.
   - **Address**: Extract from the address field.
3. Return `SCRAPE_PLACE_RESULT`.

**Edge cases:**
- Page redirects to search (place doesn't exist) → detect by URL change or missing place panel → status = `not_found`.
- Category text missing → return empty array (will use default mapping).
- Consent/cookie dialogs → may need to auto-dismiss.

---

## Phase 4: Popup UI (`src/popup/`)

Build with Preact. Minimal, functional UI.

### 4.1 — App structure

```
App.tsx
├── Dashboard.tsx       # Main view: list selector, action buttons
├── AuditProgress.tsx   # Progress bar during audit
├── Report.tsx          # Audit results & move plan
├── MoveExecutor.tsx    # Move confirmation & execution progress
└── components/
    ├── Button.tsx
    ├── ProgressBar.tsx
    ├── PlaceList.tsx
    └── StatusBadge.tsx
```

Styles: plain CSS file (or CSS modules). Keep it simple.

### 4.2 — Dashboard view

- On open: load cached lists from IndexedDB (via background message).
- Show list of saved lists with place counts and last-synced date.
- "Sync Lists" button: triggers `SYNC_LISTS`, shows spinner, updates list.
- Click a list → shows "Run Audit" button.

### 4.3 — Audit progress view

- Shown when audit is running.
- Progress bar: "Checking 14/87"
- Current place name being checked.
- "Pause" / "Resume" button.
- On completion → transitions to Report view.

### 4.4 — Report view

Displays audit results for the selected list:

**Problems section:**
- Permanently Closed places (red indicator)
- Temporarily Closed places (yellow indicator)
- Not Found places (gray indicator)

Each entry shows: name, address, category.

**Category breakdown:**
- Active places grouped by detected category with counts.

**Move plan:**
- Table: Place Name | Current List | → Target List
- Based on category mappings from config.
- Checkboxes for each row (all selected by default).
- "Execute Selected Moves" button → transitions to MoveExecutor.

**Export:**
- "Copy as Markdown" button → formats report and copies to clipboard.
- "Download Markdown" button → triggers file download.

### 4.5 — Move executor view

- Shows progress: "Moving 5/23 places..."
- Per-move status updates.
- On completion: summary of moves performed.
- Link to move log.

---

## Phase 5: Options Page (`src/options/`)

### 5.1 — Category mapping editor

- Table of current mappings: Categories (comma-separated) → Target List.
- "Add mapping" row.
- Edit/delete existing mappings.
- Default/fallback list name field.
- "Reset to defaults" button.

### 5.2 — Audit settings

- Delay between checks (slider: 2–10 seconds).
- Cache TTL (slider: 1–90 days).

### 5.3 — Move log viewer

- Table of past moves: timestamp, place name, source → target.
- "Clear log" button.

---

## Phase 6: Report Generation (`src/shared/report.ts`)

### 6.1 — Markdown report generator

Function `generateMarkdownReport(listName, places, movePlan)` returns a string:

```markdown
# Audit Report: Want to go
**Date:** 2024-01-15
**Total places:** 87

## Problems

### Permanently Closed (3)
| Place | Address | Category |
|---|---|---|
| Old Restaurant | 123 Main St | Restaurant |
...

### Temporarily Closed (1)
...

### Not Found (2)
...

## Category Breakdown
- Restaurant: 23
- Café: 11
- Museum: 5
- Other: 8

## Move Plan
| Place | From | To |
|---|---|---|
| Good Restaurant | Want to go | Wishlist / Restaurants |
...
```

### 6.2 — Clipboard / download helpers

- `copyToClipboard(text)` — uses `navigator.clipboard.writeText()`.
- `downloadAsFile(text, filename)` — creates blob URL, triggers download.

---

## Implementation Order

| Step | What | Depends On |
|---|---|---|
| 1 | Phase 0: Scaffolding (files, configs, build) | — |
| 2 | Phase 1.1–1.2: Types + Messages | Step 1 |
| 3 | Phase 1.3: IndexedDB layer | Step 2 |
| 4 | Phase 1.4–1.5: Selectors + Config defaults | Step 2 |
| 5 | Phase 2.1–2.2: Background script + Sync handler | Steps 2–4 |
| 6 | Phase 3.1: Interests content script (scraping) | Steps 2, 4 |
| 7 | Phase 3.2: Place content script | Steps 2, 4 |
| 8 | Phase 2.3: Audit orchestrator | Steps 5, 7 |
| 9 | Phase 4.1–4.3: Popup (Dashboard + Audit progress) | Steps 5, 8 |
| 10 | Phase 6: Report generation | Step 2 |
| 11 | Phase 4.4: Popup (Report view) | Steps 9, 10 |
| 12 | Phase 2.4: Move executor (background) | Steps 5, 6 |
| 13 | Phase 3.1 (move part): Interests content script (moves) | Steps 6, 12 |
| 14 | Phase 4.5: Popup (Move executor view) | Steps 12, 13 |
| 15 | Phase 5: Options page | Steps 3, 4 |

## Selector Discovery Strategy

The DOM selectors in `selectors.ts` are the critical unknown. Strategy:

1. Ship initial implementation with **empty/placeholder selectors**.
2. Load the extension in Firefox, navigate to `google.com/interests/saved` and `google.com/maps/place/...`.
3. Use Firefox DevTools to manually inspect the DOM and identify reliable selectors.
4. Update `selectors.ts` with discovered selectors.
5. Repeat as Google changes their DOM (expected maintenance burden).

Selector heuristics to try, in order of preference:
- `aria-label` attributes (most stable)
- `data-*` attributes
- Semantic HTML elements (`h1`, `h2`, `address`, etc.)
- Class names containing semantic substrings (fragile but sometimes necessary)
- Text content matching (last resort)

## Testing Strategy

- **Unit tests** for pure functions: `db.ts`, `report.ts`, `messages.ts`, `config.ts`.
- **Manual testing** is primary for content scripts (DOM interaction with live Google pages).
- Test with a Google account that has multiple saved lists with a mix of open, closed, and deleted places.
