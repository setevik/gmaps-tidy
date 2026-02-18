# Known Unknowns

Areas requiring further research or validation before `gmaps-tidy` can be considered fully production-ready.

---

## 1. DOM Selector Stability

**Risk: Critical**

The entire extension depends on Google's DOM structure remaining stable. Every content script selector — from `a[href*="/interests/saved/list/"]` for list cards to `button[jsaction*="pane.rating.category"]` for place categories — can break without warning when Google ships UI changes.

**What needs research:**

- **Breakage detection**: How should the extension detect that selectors have stopped matching? Currently a failed selector returns `null` silently. There is no mechanism to alert the user that selectors are stale.
- **Selector update cadence**: How frequently does Google change the relevant DOM? Is it monthly, quarterly, or unpredictable? This determines the maintenance burden.
- **Fallback strategies**: Are there Google APIs (official or undocumented) that could replace DOM scraping for any of the operations (listing saved places, reading place status, moving items between lists)?
- **Move-operation DOM flow**: The move flow (`More options → Move to a collection → pick target`) was implemented from DOM inspection but has not been validated end-to-end against a live Google account. The exact sequence of menus, dialogs, and confirmation steps may differ from what the selectors assume.

---

## 2. Google Rate Limiting & Bot Detection

**Risk: High**

The audit loop opens a new tab for every saved place, waits for the page to render, scrapes data, and closes the tab. This pattern could trigger Google's anti-automation defenses.

**What needs research:**

- **Throttling thresholds**: At what request rate does Google start serving CAPTCHAs, blocking requests, or degrading responses? The current 2-second delay between checks is a guess.
- **Session/cookie behavior**: Does opening many tabs to `google.com/maps/place/*` in rapid succession cause session invalidation or temporary account lockout?
- **Consent/cookie walls**: Google periodically shows cookie consent dialogs. The extension has no logic to dismiss these. How often do they appear, and what DOM elements are involved?
- **Detection signals**: Does Google fingerprint extension-driven tab creation differently from user-driven navigation? Could `tabs.create({ active: false })` be a flag?

---

## 3. Large List Performance

**Risk: Medium-High**

The extension has not been tested at scale.

**What needs research:**

- **Scroll-to-load limits**: `scrollToLoadAll()` caps at 50 scroll iterations. Is this enough for lists with hundreds or thousands of places? Does Google paginate differently for very large lists?
- **IndexedDB capacity**: Storing thousands of `Place` objects with full metadata — are there practical storage limits? What happens when IndexedDB quota is exceeded? (Currently unhandled.)
- **Audit duration**: At 2 seconds per place, a 500-place list takes ~17 minutes. Is the alarm-driven loop reliable over that duration? Does Firefox suspend the event page mid-audit, and does recovery (`recoverAuditIfNeeded`) actually work?
- **Memory pressure**: Opening and closing hundreds of tabs sequentially — does this leak memory in Firefox? Are closed tabs fully garbage collected?

---

## 4. Move Operation Reliability

**Risk: High**

Moving places between lists is the most complex DOM interaction and the highest-stakes operation (it modifies user data).

**What needs research:**

- **Move confirmation flow**: Does Google show a confirmation dialog after selecting the target list, or does the move happen immediately? The current code assumes immediate execution after `targetEl.click()`.
- **Move animation timing**: The code waits 1000ms after clicking the target list. Is this sufficient for Google's UI to complete the move and update the DOM?
- **Batch move support**: Does Google's UI support selecting multiple places and moving them at once, or must moves be done one at a time? The current implementation does them sequentially.
- **Undo/rollback**: There is no undo mechanism. If a move goes wrong (wrong target list, partial batch failure), the user has no automated way to revert. The move log records what happened but doesn't support reversal.
- **Target list validation**: The extension assumes target list names (e.g., "Wishlist / Restaurants") already exist in the user's Google Maps. What happens if they don't? Does the picker show a "create new list" option, and should the extension use it?
- **Place disappearance after move**: After a place is moved out of the source list, does the DOM remove the element immediately? Could this affect subsequent moves in the same batch (shifting indices, breaking selectors for remaining items)?

---

## 5. Firefox MV3 Event Page Behavior

**Risk: Medium**

The background script is designed as an MV3 event page that persists state to IndexedDB and uses `browser.alarms` to survive suspension. This design is correct in theory but has practical uncertainties.

**What needs research:**

- **Suspension timing**: How quickly does Firefox suspend an idle event page? Is the 2-second inter-check delay long enough to trigger suspension mid-audit?
- **Alarm granularity**: PLAN.md notes that `browser.alarms` minimum is ~1 minute in some browsers but claims Firefox allows sub-minute. This needs verification on current Firefox versions. The code uses `delayInMinutes: delayMs / 60000` (0.033 minutes for 2s) — does this actually fire after 2 seconds?
- **Tab API from suspended context**: When the event page wakes from an alarm, can it immediately call `browser.tabs.create()` and `browser.tabs.sendMessage()`, or is there a warm-up delay?
- **Concurrent message handling**: If the popup sends a message while an alarm handler is running, does Firefox queue it or deliver it immediately? Could this cause state corruption in IndexedDB?

---

## 6. Place Status Detection Accuracy

**Risk: Medium**

Status detection (`place.ts:detectStatus()`) uses full-page text search for "permanently closed" and "temporarily closed". This is a blunt instrument.

**What needs research:**

- **False positives**: Could a review mentioning "permanently closed" trigger a false detection? The current regex searches `document.body.innerText`, which includes reviews, user content, and nearby-places text.
- **Localization**: Does this only work for English-language Google Maps? Users with Google set to another language will see translated status text (e.g., "dauerhaft geschlossen" in German). The extension has no i18n support.
- **Other statuses**: Are there Google Maps statuses beyond open/permanently closed/temporarily closed/not found? For example: "Moved to a new location", "Under renovation", seasonal businesses.
- **Not-found heuristic**: The code treats a missing `<h1>` as "not_found". Is this reliable? Could a slow-loading page trigger a false not-found? Are there other redirect patterns when a place is deleted?

---

## 7. Category Matching Quality

**Risk: Medium**

Category resolution uses a first-match-wins strategy against the user's mapping table.

**What needs research:**

- **Multi-category places**: A place listed as "Restaurant · Bar" matches both categories. The first mapping in the list wins, which may not be the user's intent. Should there be a priority/specificity system?
- **Category taxonomy**: What is the full set of Google Maps categories? Is there an official list? How do sub-categories relate to parent categories (e.g., is "Sushi restaurant" a match for a "Restaurant" mapping)?
- **Category consistency**: Does Google always show the same categories for a place, or do they vary by locale, language, or device?
- **Unmapped categories**: Places with categories not in any mapping fall to `DEFAULT_FALLBACK_LIST`. For users with many niche categories, this could dump most places into "Other". Should the report highlight unmapped categories to help users refine their mappings?

---

## 8. Authentication & Session State

**Risk: Medium**

The extension relies on the user being logged into Google in Firefox.

**What needs research:**

- **Multi-account handling**: If a user is logged into multiple Google accounts, which account's saved places does the extension see? Does `google.com/interests/saved` always use the default account?
- **Session expiry**: Can a Google session expire mid-audit (e.g., during a 30-minute audit of a large list)? How would this manifest — a login redirect? An error page?
- **Incognito/private mode**: Does the extension work in private browsing? Are permissions different?

---

## 9. Distribution & Update Strategy

**Risk: Low (but necessary for real users)**

**What needs research:**

- **AMO submission**: Can this extension pass Mozilla's review process? The `host_permissions` for `google.com` and the DOM-scraping approach may raise flags. What justification is needed?
- **Update mechanism**: When selectors break (inevitable), how quickly can an update be pushed? AMO review times vary. Should the extension support a remote selector config that can be updated without a full extension release?
- **Privacy policy**: The extension reads all of a user's Google Maps saved places data. AMO and Google's policies may require a privacy policy even though no data leaves the browser.
- **Minimum Firefox version**: What is the minimum Firefox version that supports all the MV3 APIs used (`browser.alarms`, `browser.action`, event pages)? This determines the `strict_min_version` in the manifest.

---

## 10. Error Recovery & User Communication

**Risk: Medium**

Errors are logged to the console but rarely surfaced to the user.

**What needs research:**

- **Retry strategies**: Which operations are safe to retry (scraping a place page) vs. dangerous to retry (moving a place that may have already moved)? The extension currently has no retry logic.
- **Error messaging**: What error messages are meaningful to end users? "Timeout waiting for `button[jsaction*='pane.rating.category']`" is not actionable. What should the user-facing message say?
- **Partial audit recovery**: If an audit fails at place 45/100, the user can resume. But is the IndexedDB state guaranteed to be consistent? What if the failure happened between writing a place result and advancing the queue index?

---

## Summary Priority Matrix

| Area | Risk | Impact of Not Resolving |
|------|------|------------------------|
| DOM Selector Stability | Critical | Extension stops working entirely |
| Rate Limiting / Bot Detection | High | Account lockout or CAPTCHAs mid-audit |
| Move Operation Reliability | High | User data corruption (wrong list moves) |
| Large List Performance | Medium-High | Audit hangs or crashes on real-world lists |
| Place Status Detection | Medium | Incorrect audit results (false positives/negatives) |
| Event Page Behavior | Medium | Audit stalls or loses progress silently |
| Category Matching | Medium | Places sorted into wrong lists |
| Auth & Session State | Medium | Silent failures for multi-account users |
| Error Recovery | Medium | Users stuck with no clear fix |
| Distribution | Low | Blocks public release |
