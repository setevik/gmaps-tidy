import { openDB, type IDBPDatabase } from "idb";
import type {
  AuditConfig,
  AuditState,
  CategoryMapping,
  MoveLogEntry,
  Place,
  SavedList,
} from "./types";

const DB_NAME = "gmaps-tidy";
const DB_VERSION = 1;

// ── Store names ────────────────────────────────────────────────────

const LISTS = "lists" as const;
const PLACES = "places" as const;
const MOVE_LOG = "moveLog" as const;
const CONFIG = "config" as const;

// ── Config keys stored in the config object store ──────────────────

export type ConfigKey =
  | "categoryMappings"
  | "fallbackList"
  | "auditConfig"
  | "auditState";

export interface ConfigMap {
  categoryMappings: CategoryMapping[];
  fallbackList: string;
  auditConfig: AuditConfig;
  auditState: AuditState | null;
}

interface ConfigEntry<K extends ConfigKey = ConfigKey> {
  key: K;
  value: ConfigMap[K];
}

// ── Database singleton ─────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Lists store — keyed by list name
        if (!db.objectStoreNames.contains(LISTS)) {
          db.createObjectStore(LISTS, { keyPath: "name" });
        }

        // Places store — keyed by Maps URL
        if (!db.objectStoreNames.contains(PLACES)) {
          const placeStore = db.createObjectStore(PLACES, {
            keyPath: "mapsUrl",
          });
          placeStore.createIndex("byList", "listName", { unique: false });
          placeStore.createIndex("byStatus", "status", { unique: false });
          placeStore.createIndex("byLastChecked", "lastChecked", {
            unique: false,
          });
        }

        // Move log — auto-increment key
        if (!db.objectStoreNames.contains(MOVE_LOG)) {
          const moveStore = db.createObjectStore(MOVE_LOG, {
            autoIncrement: true,
          });
          moveStore.createIndex("byExecutedAt", "executedAt", {
            unique: false,
          });
          moveStore.createIndex("bySourceList", "sourceList", {
            unique: false,
          });
        }

        // Config store — key-value pairs
        if (!db.objectStoreNames.contains(CONFIG)) {
          db.createObjectStore(CONFIG, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// ── Lists ──────────────────────────────────────────────────────────

export async function getLists(): Promise<SavedList[]> {
  const db = await getDb();
  return db.getAll(LISTS);
}

export async function saveLists(lists: SavedList[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(LISTS, "readwrite");
  await Promise.all([
    // Clear existing lists and write fresh
    tx.store.clear(),
    ...lists.map((list) => tx.store.put(list)),
    tx.done,
  ]);
}

// ── Places ─────────────────────────────────────────────────────────

export async function getPlacesByList(listName: string): Promise<Place[]> {
  const db = await getDb();
  return db.getAllFromIndex(PLACES, "byList", listName);
}

export async function savePlace(place: Place): Promise<void> {
  const db = await getDb();
  await db.put(PLACES, place);
}

export async function savePlaces(places: Place[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(PLACES, "readwrite");
  await Promise.all([...places.map((p) => tx.store.put(p)), tx.done]);
}

/**
 * Returns places in `listName` that have never been checked or whose
 * lastChecked timestamp is older than `ttlDays` days ago.
 */
export async function getStaleOrUnchecked(
  listName: string,
  ttlDays: number,
): Promise<Place[]> {
  const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
  const all = await getPlacesByList(listName);
  return all.filter((p) => p.lastChecked === null || p.lastChecked < cutoff);
}

// ── Move log ───────────────────────────────────────────────────────

export async function logMove(entry: MoveLogEntry): Promise<void> {
  const db = await getDb();
  await db.add(MOVE_LOG, entry);
}

export async function getMoveLog(): Promise<MoveLogEntry[]> {
  const db = await getDb();
  return db.getAll(MOVE_LOG);
}

export async function clearMoveLog(): Promise<void> {
  const db = await getDb();
  await db.clear(MOVE_LOG);
}

// ── Config ─────────────────────────────────────────────────────────

export async function getConfig<K extends ConfigKey>(
  key: K,
): Promise<ConfigMap[K] | undefined> {
  const db = await getDb();
  const entry: ConfigEntry<K> | undefined = await db.get(CONFIG, key);
  return entry?.value;
}

export async function setConfig<K extends ConfigKey>(
  key: K,
  value: ConfigMap[K],
): Promise<void> {
  const db = await getDb();
  const entry: ConfigEntry<K> = { key, value };
  await db.put(CONFIG, entry);
}
