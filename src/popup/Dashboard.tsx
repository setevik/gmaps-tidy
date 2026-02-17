import { h } from "preact";
import type { SavedList } from "@shared/types";

interface DashboardProps {
  lists: SavedList[];
  selectedList: string;
  onSelectList: (name: string) => void;
  onSync: () => void;
  syncing: boolean;
  onStartAudit: () => void;
}

export function Dashboard({
  lists,
  selectedList,
  onSelectList,
  onSync,
  syncing,
  onStartAudit,
}: DashboardProps) {
  return (
    <div class="flex-col gap-12">
      {/* Sync section */}
      <div class="section">
        <div class="flex items-center justify-between">
          <div class="section-title">Saved Lists</div>
          <button class="btn btn-sm" onClick={onSync} disabled={syncing}>
            {syncing ? "Syncing\u2026" : "Sync Lists"}
          </button>
        </div>

        {lists.length === 0 ? (
          <p class="muted mt-8">
            No lists synced yet. Click "Sync Lists" to start.
          </p>
        ) : (
          <div class="mt-8">
            {lists.map((list) => (
              <div class="list-item" key={list.name}>
                <span>{list.name}</span>
                <span class="muted">{list.placeCount} places</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit section */}
      {lists.length > 0 && (
        <div class="section">
          <div class="section-title">Audit a List</div>
          <select
            class="select"
            value={selectedList}
            onChange={(e) =>
              onSelectList((e.target as HTMLSelectElement).value)
            }
          >
            {lists.map((list) => (
              <option key={list.name} value={list.name}>
                {list.name} ({list.placeCount})
              </option>
            ))}
          </select>
          <button
            class="btn btn-primary btn-block mt-8"
            onClick={onStartAudit}
            disabled={!selectedList}
          >
            Start Audit
          </button>
        </div>
      )}
    </div>
  );
}
