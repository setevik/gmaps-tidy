/**
 * All Google DOM selectors isolated in one module.
 *
 * These are the most fragile part of the extension — Google can change
 * their DOM at any time. When that happens, update selectors here.
 *
 * Discovery order of preference:
 *  1. aria-label attributes (most stable)
 *  2. data-* attributes
 *  3. Semantic HTML elements (h1, h2, address, etc.)
 *  4. Class names with semantic substrings (fragile)
 *  5. Text content matching (last resort)
 *
 * All values are CSS selector strings unless noted otherwise.
 */

export const INTERESTS_SELECTORS = {
  /* ──────────── Collections / Saved page ──────────── */

  /** Container element for each saved list on the interests/saved page.
   *  aria-label follows pattern: "NAME, N item(s), Private|Shared" */
  listContainer: 'a[href*="/interests/saved/list/"]',

  /** List name — no stable DOM child selector exists.
   *  Parse from listContainer's aria-label with listAriaLabelRegex → group 1 */
  listName: null as null,

  /** Place count — no stable DOM child selector exists.
   *  Parse from listContainer's aria-label with listAriaLabelRegex → group 2 */
  listPlaceCount: null as null,

  /** Regex to extract name, count, and privacy from a collection card's aria-label.
   *  Groups: [1] name, [2] count string (e.g. "99+ items"), [3] "Private" | "Shared" */
  listAriaLabelRegex: /^(.+?),\s*(\d+\+?\s*items?),\s*(Private|Shared)$/,

  /** "Create a new collection" button */
  createCollectionButton: 'a[aria-label="Create a new collection"]',

  /** Search input */
  searchInput: 'input[aria-label="Search in Saved"][role="combobox"]',

  /* ──────────── List detail page ──────────── */

  /** List title heading (the visible <h2> on the list detail page) */
  listDetailTitle: 'h2',

  /** Wrapper div holding the full list (carries the list ID in data-id) */
  listDataContainer: 'div[data-viewer-group][data-id]',

  /** Individual place entry wrapper (carries place identity in data-item-id) */
  placeEntry: 'div[data-item-id]',

  /** Clickable row container for each place entry */
  placeEntryLink: 'div[role="link"][data-viewer-entrypoint]',

  /** Place name link (href → /maps/place/…; aria-label = place name) */
  placeName: 'a[href*="/maps/place/"][aria-label]',

  /** Link to the place's Maps page (same element as placeName) */
  placeUrl: 'a[href*="/maps/place/"][aria-label]',

  /** Star-rating indicator (aria-label e.g. "Rated 5 out of 5") */
  placeStarRating: 'div[aria-label^="Rated"]',

  /** Place thumbnail image (only 1 <img> per data-item-id wrapper) */
  placeImage: 'div[data-item-id] img',

  /** "More options" overflow button per place (aria-label = "More options for {name}") */
  placeMoreOptions: 'button[aria-label^="More options for"]',

  /** "More options" button for the list itself — interpolate list name at runtime.
   *  Usage: `button[aria-label="More options for ${listName}"]` */
  listMoreOptionsTemplate: 'button[aria-label="More options for {{LIST_NAME}}"]',

  /* ──────────── Overflow menu items (via data-action) ──────────── */

  /** "Edit" action for the list */
  menuEditList: 'li[role="menuitem"][data-action="actionEditList"]',

  /** "Edit" action for a place item */
  menuEditItem: 'li[role="menuitem"][data-action="actionEditItem"]',

  /** "Add to a collection" action */
  menuAddItemToList: 'li[role="menuitem"][data-action="actionAddItemToList"]',

  /** "Move to a collection" action */
  menuMoveItemToList: 'li[role="menuitem"][data-action="actionMoveItemToList"]',

  /** "Remove" action (delete item from list) */
  menuDeleteItem: 'li[role="menuitem"][data-action="actionDeleteItem"]',

  /** "Report" action */
  menuReportAbuse: 'li[role="menuitem"][data-action="actionReportAbuse"]',

  /** Back button (on list detail page) */
  backButton: 'button[aria-label="Back"]',
};
