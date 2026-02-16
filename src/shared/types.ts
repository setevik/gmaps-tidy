export interface SavedList {
  name: string;
  placeCount: number;
  lastSynced: number | null;
}

export type PlaceStatus =
  | "unknown"
  | "open"
  | "permanently_closed"
  | "temporarily_closed"
  | "not_found";

export interface Place {
  name: string;
  mapsUrl: string;
  listName: string;
  address: string | null;
  categories: string[];
  status: PlaceStatus;
  lastChecked: number | null;
}

export interface CategoryMapping {
  /** Google Maps categories that match (case-insensitive comparison at runtime) */
  categories: string[];
  /** Target list name to move matching places into */
  targetList: string;
}

export interface MoveOperation {
  placeName: string;
  mapsUrl: string;
  sourceList: string;
  targetList: string;
}

export interface MoveLogEntry extends MoveOperation {
  executedAt: number;
  success: boolean;
}

export interface AuditConfig {
  /** Delay in ms between place checks (default: 2000) */
  delayMs: number;
  /** How many days before a cached place result is considered stale (default: 30) */
  cacheTtlDays: number;
}

export type AuditStateStatus = "running" | "paused" | "done" | "error";

export interface AuditState {
  listName: string;
  queuedUrls: string[];
  currentIndex: number;
  state: AuditStateStatus;
}

export interface AuditProgress {
  state: "idle" | AuditStateStatus;
  current: number;
  total: number;
  currentPlaceName: string | null;
}

export interface PlaceScrapeResult {
  status: PlaceStatus;
  categories: string[];
  address: string | null;
}

export interface MoveResult {
  success: boolean;
  errors: string[];
}
