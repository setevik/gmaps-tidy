import type { AuditConfig, CategoryMapping } from "./types";

/** Milliseconds between place status checks */
export const DEFAULT_DELAY_MS = 2000;

/** Days before a cached place result is considered stale */
export const DEFAULT_CACHE_TTL_DAYS = 30;

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  delayMs: DEFAULT_DELAY_MS,
  cacheTtlDays: DEFAULT_CACHE_TTL_DAYS,
};

export const DEFAULT_CATEGORY_MAPPINGS: CategoryMapping[] = [
  { categories: ["Restaurant"], targetList: "Wishlist / Restaurants" },
  { categories: ["Bakery"], targetList: "Wishlist / Bakeries" },
  { categories: ["Café", "Coffee shop"], targetList: "Wishlist / Cafés" },
  { categories: ["Bar"], targetList: "Wishlist / Bars" },
  {
    categories: ["Museum", "Art gallery"],
    targetList: "Wishlist / Culture",
  },
];

export const DEFAULT_FALLBACK_LIST = "Wishlist / Other";

/**
 * Resolve a place's categories to a target list name using the given mappings.
 * Comparison is case-insensitive. Returns `fallbackList` if no mapping matches.
 */
export function resolveTargetList(
  placeCategories: string[],
  mappings: CategoryMapping[],
  fallbackList: string,
): string {
  const lowerPlaceCats = placeCategories.map((c) => c.toLowerCase());
  for (const mapping of mappings) {
    const lowerMappingCats = mapping.categories.map((c) => c.toLowerCase());
    if (lowerPlaceCats.some((pc) => lowerMappingCats.includes(pc))) {
      return mapping.targetList;
    }
  }
  return fallbackList;
}
