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
 * Placeholders marked with TODO require manual DevTools inspection.
 */

export const INTERESTS_SELECTORS = {
  /** Container element for each saved list on the interests/saved page */
  listContainer: '[data-list-id]', // TODO: inspect actual DOM

  /** List name text within a list container */
  listName: 'h2', // TODO: inspect actual DOM

  /** Place count label within a list container */
  listPlaceCount: '[aria-label*="place"]', // TODO: inspect actual DOM

  /** Individual place entry row */
  placeEntry: '[data-place-id]', // TODO: inspect actual DOM

  /** Place name text within a place entry */
  placeName: 'a[href*="/maps/place/"]', // TODO: inspect actual DOM

  /** Link to the place's Maps page */
  placeUrl: 'a[href*="/maps/place/"]', // TODO: inspect actual DOM

  /** Address snippet within a place entry */
  placeAddress: '[data-address]', // TODO: inspect actual DOM

  /** Checkbox for selecting a place (bulk operations) */
  moveCheckbox: 'input[type="checkbox"]', // TODO: inspect actual DOM

  /** "Move to collection" action button */
  moveToCollectionButton: '[aria-label*="Move"]', // TODO: inspect actual DOM

  /** Target list option in the move dialog */
  targetListOption: '[role="option"]', // TODO: inspect actual DOM
};

export const PLACE_SELECTORS = {
  /** Business status text ("Permanently closed", "Temporarily closed") */
  businessStatus: '[data-attrid="kc:/location/location:status"]', // TODO: inspect actual DOM

  /** Category/type label (e.g. "Restaurant", "Bakery") */
  placeCategory: 'button[jsaction*="category"]', // TODO: inspect actual DOM

  /** Full address text */
  placeAddress: '[data-item-id="address"]', // TODO: inspect actual DOM

  /** Indicator that the place was not found (redirect to search results) */
  notFoundIndicator: '#search', // TODO: inspect actual DOM
};
