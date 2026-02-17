import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import type { AuditConfig, CategoryMapping, MoveLogEntry } from "@shared/types";
import {
  getConfig,
  setConfig,
  getMoveLog,
  clearMoveLog,
} from "@shared/db";
import {
  DEFAULT_AUDIT_CONFIG,
  DEFAULT_CATEGORY_MAPPINGS,
  DEFAULT_FALLBACK_LIST,
} from "@shared/config";
import "./options.css";

// ── Toast helper ──────────────────────────────────────────────────

type ToastKind = "success" | "error";

function Toast({ kind, text }: { kind: ToastKind; text: string }) {
  return (
    <div class={`toast ${kind === "success" ? "toast-success" : "toast-error"}`}>
      {text}
    </div>
  );
}

// ── Category Mappings Editor ──────────────────────────────────────

function CategoryMappingsEditor() {
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [fallback, setFallback] = useState(DEFAULT_FALLBACK_LIST);
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      const m = await getConfig("categoryMappings");
      setMappings(m ?? DEFAULT_CATEGORY_MAPPINGS);
      const f = await getConfig("fallbackList");
      setFallback(f ?? DEFAULT_FALLBACK_LIST);
    })();
  }, []);

  function updateMapping(
    idx: number,
    field: "categories" | "targetList",
    value: string,
  ) {
    setMappings((prev) => {
      const next = [...prev];
      if (field === "categories") {
        next[idx] = {
          ...next[idx],
          categories: value.split(",").map((s) => s.trim()).filter(Boolean),
        };
      } else {
        next[idx] = { ...next[idx], targetList: value };
      }
      return next;
    });
  }

  function addMapping() {
    setMappings((prev) => [...prev, { categories: [], targetList: "" }]);
  }

  function removeMapping(idx: number) {
    setMappings((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetToDefaults() {
    setMappings(DEFAULT_CATEGORY_MAPPINGS);
    setFallback(DEFAULT_FALLBACK_LIST);
  }

  async function save() {
    try {
      await setConfig("categoryMappings", mappings);
      await setConfig("fallbackList", fallback);
      setToast({ kind: "success", text: "Category mappings saved." });
    } catch (err) {
      setToast({ kind: "error", text: `Save failed: ${err}` });
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div class="section">
      <h2>Category Mappings</h2>
      <p class="muted" style={{ marginBottom: "12px" }}>
        Map Google Maps categories to target lists. A place matching any listed
        category will be suggested for the corresponding target list.
      </p>

      {toast && <Toast kind={toast.kind} text={toast.text} />}

      {mappings.map((m, i) => (
        <div class="mapping-row" key={i}>
          <div class="field">
            <label class="field-label">Categories (comma-separated)</label>
            <input
              type="text"
              value={m.categories.join(", ")}
              onInput={(e) =>
                updateMapping(i, "categories", (e.target as HTMLInputElement).value)
              }
            />
          </div>
          <div class="field">
            <label class="field-label">Target list</label>
            <input
              type="text"
              value={m.targetList}
              onInput={(e) =>
                updateMapping(i, "targetList", (e.target as HTMLInputElement).value)
              }
            />
          </div>
          <button
            class="btn btn-sm btn-danger remove-btn"
            onClick={() => removeMapping(i)}
            title="Remove mapping"
          >
            Remove
          </button>
        </div>
      ))}

      <div class="field mt-12">
        <label class="field-label">Fallback list</label>
        <input
          type="text"
          value={fallback}
          onInput={(e) => setFallback((e.target as HTMLInputElement).value)}
        />
        <div class="field-hint">
          Places that don't match any mapping go here.
        </div>
      </div>

      <div class="flex gap-8 mt-12">
        <button class="btn" onClick={addMapping}>
          Add Mapping
        </button>
        <button class="btn" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
        <button class="btn btn-primary" onClick={save}>
          Save Mappings
        </button>
      </div>
    </div>
  );
}

// ── Audit Settings Editor ─────────────────────────────────────────

function AuditSettingsEditor() {
  const [delayMs, setDelayMs] = useState(DEFAULT_AUDIT_CONFIG.delayMs);
  const [cacheTtlDays, setCacheTtlDays] = useState(
    DEFAULT_AUDIT_CONFIG.cacheTtlDays,
  );
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      const cfg = await getConfig("auditConfig");
      if (cfg) {
        setDelayMs(cfg.delayMs);
        setCacheTtlDays(cfg.cacheTtlDays);
      }
    })();
  }, []);

  async function save() {
    const config: AuditConfig = {
      delayMs: Math.max(500, delayMs),
      cacheTtlDays: Math.max(1, cacheTtlDays),
    };
    try {
      await setConfig("auditConfig", config);
      setToast({ kind: "success", text: "Audit settings saved." });
    } catch (err) {
      setToast({ kind: "error", text: `Save failed: ${err}` });
    }
    setTimeout(() => setToast(null), 3000);
  }

  function resetToDefaults() {
    setDelayMs(DEFAULT_AUDIT_CONFIG.delayMs);
    setCacheTtlDays(DEFAULT_AUDIT_CONFIG.cacheTtlDays);
  }

  return (
    <div class="section">
      <h2>Audit Settings</h2>

      {toast && <Toast kind={toast.kind} text={toast.text} />}

      <div class="field">
        <label class="field-label">Delay between checks (ms)</label>
        <input
          type="number"
          min="500"
          step="100"
          value={delayMs}
          onInput={(e) =>
            setDelayMs(parseInt((e.target as HTMLInputElement).value, 10) || 0)
          }
        />
        <div class="field-hint">
          Minimum 500 ms. Higher values are gentler on Google's servers.
        </div>
      </div>

      <div class="field">
        <label class="field-label">Cache TTL (days)</label>
        <input
          type="number"
          min="1"
          step="1"
          value={cacheTtlDays}
          onInput={(e) =>
            setCacheTtlDays(
              parseInt((e.target as HTMLInputElement).value, 10) || 0,
            )
          }
        />
        <div class="field-hint">
          Places checked within this window are skipped during audit.
        </div>
      </div>

      <div class="flex gap-8 mt-12">
        <button class="btn" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
        <button class="btn btn-primary" onClick={save}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ── Move Log Viewer ───────────────────────────────────────────────

function MoveLogViewer() {
  const [entries, setEntries] = useState<MoveLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const log = await getMoveLog();
      // Show newest first
      setEntries(log.sort((a, b) => b.executedAt - a.executedAt));
      setLoading(false);
    })();
  }, []);

  async function handleClear() {
    await clearMoveLog();
    setEntries([]);
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <div class="section">
      <div class="flex items-center justify-between">
        <h2>Move Log</h2>
        {entries.length > 0 && (
          <button class="btn btn-sm btn-danger" onClick={handleClear}>
            Clear Log
          </button>
        )}
      </div>

      {loading ? (
        <p class="muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p class="empty-state">No moves recorded yet.</p>
      ) : (
        <table class="log-table">
          <thead>
            <tr>
              <th>Place</th>
              <th>From</th>
              <th>To</th>
              <th>When</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i}>
                <td>{entry.placeName}</td>
                <td>{entry.sourceList}</td>
                <td>{entry.targetList}</td>
                <td class="muted">{formatDate(entry.executedAt)}</td>
                <td>
                  <span
                    class={`badge ${entry.success ? "badge-green" : "badge-red"}`}
                  >
                    {entry.success ? "OK" : "Failed"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────

export function OptionsApp() {
  return (
    <div>
      <h1>gmaps-tidy Options</h1>
      <CategoryMappingsEditor />
      <AuditSettingsEditor />
      <MoveLogViewer />
    </div>
  );
}
