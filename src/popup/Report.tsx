import { h } from "preact";
import { useState, useMemo } from "preact/hooks";
import type { CategoryMapping, MoveOperation, Place } from "@shared/types";
import {
  resolveTargetList,
  DEFAULT_CATEGORY_MAPPINGS,
  DEFAULT_FALLBACK_LIST,
} from "@shared/config";

interface ReportProps {
  places: Place[];
  listName: string;
  categoryMappings: CategoryMapping[];
  fallbackList: string;
  onExecuteMoves: (ops: MoveOperation[]) => void;
}

// ── Status badge helper ────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "permanently_closed":
      return "badge badge-red";
    case "temporarily_closed":
      return "badge badge-yellow";
    default:
      return "badge badge-gray";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "permanently_closed":
      return "closed";
    case "temporarily_closed":
      return "temp. closed";
    case "not_found":
      return "not found";
    default:
      return status;
  }
}

// ── Component ──────────────────────────────────────────────────────

export function Report({
  places,
  listName,
  categoryMappings,
  fallbackList,
  onExecuteMoves,
}: ReportProps) {
  // Derived data
  const { healthy, problems, permClosed, tempClosed, notFound } =
    useMemo(() => {
      const probs = places.filter(
        (p) =>
          p.status === "permanently_closed" ||
          p.status === "temporarily_closed" ||
          p.status === "not_found",
      );
      return {
        healthy: places.filter((p) => p.status === "open"),
        problems: probs,
        permClosed: probs.filter((p) => p.status === "permanently_closed"),
        tempClosed: probs.filter((p) => p.status === "temporarily_closed"),
        notFound: probs.filter((p) => p.status === "not_found"),
      };
    }, [places]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of places) {
      if (p.categories.length === 0) {
        counts.set("(uncategorized)", (counts.get("(uncategorized)") ?? 0) + 1);
      } else {
        for (const cat of p.categories) {
          counts.set(cat, (counts.get(cat) ?? 0) + 1);
        }
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [places]);

  // Suggested moves
  const suggestedMoves = useMemo(() => {
    const mappings = categoryMappings.length > 0
      ? categoryMappings
      : DEFAULT_CATEGORY_MAPPINGS;
    const fallback = fallbackList || DEFAULT_FALLBACK_LIST;
    const ops: MoveOperation[] = [];

    for (const p of healthy) {
      if (p.categories.length === 0) continue;
      const target = resolveTargetList(p.categories, mappings, fallback);
      if (target !== listName) {
        ops.push({
          placeName: p.name,
          mapsUrl: p.mapsUrl,
          sourceList: listName,
          targetList: target,
        });
      }
    }
    return ops;
  }, [healthy, listName, categoryMappings, fallbackList]);

  // Checkbox state — all selected by default
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestedMoves.map((op) => op.mapsUrl)),
  );

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function handleExecute() {
    const ops = suggestedMoves.filter((op) => selected.has(op.mapsUrl));
    if (ops.length > 0) onExecuteMoves(ops);
  }

  // ── Markdown export ──────────────────────────────────────────────

  function generateMarkdown(): string {
    const lines: string[] = [];
    lines.push(`# Audit Report: ${listName}`);
    lines.push(`\nTotal places: ${places.length}\n`);

    if (problems.length > 0) {
      lines.push("## Problems\n");
      if (permClosed.length > 0) {
        lines.push(`### Permanently Closed (${permClosed.length})\n`);
        for (const p of permClosed) lines.push(`- ${p.name}`);
        lines.push("");
      }
      if (tempClosed.length > 0) {
        lines.push(`### Temporarily Closed (${tempClosed.length})\n`);
        for (const p of tempClosed) lines.push(`- ${p.name}`);
        lines.push("");
      }
      if (notFound.length > 0) {
        lines.push(`### Not Found (${notFound.length})\n`);
        for (const p of notFound) lines.push(`- ${p.name}`);
        lines.push("");
      }
    }

    if (categoryBreakdown.length > 0) {
      lines.push("## Category Breakdown\n");
      for (const [cat, count] of categoryBreakdown) {
        lines.push(`- ${cat}: ${count}`);
      }
      lines.push("");
    }

    if (suggestedMoves.length > 0) {
      lines.push("## Suggested Moves\n");
      for (const op of suggestedMoves) {
        lines.push(
          `- ${op.placeName}: ${op.sourceList} \u2192 ${op.targetList}`,
        );
      }
    }

    return lines.join("\n");
  }

  function handleCopyMarkdown() {
    navigator.clipboard.writeText(generateMarkdown());
  }

  function handleDownloadMarkdown() {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${listName.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div class="flex-col gap-12">
      {/* Summary badges */}
      <div class="section">
        <div class="section-title">Audit Complete &mdash; {listName}</div>
        <div class="flex gap-8 flex-wrap">
          <span class="badge badge-green">{healthy.length} open</span>
          {permClosed.length > 0 && (
            <span class="badge badge-red">
              {permClosed.length} perm.&nbsp;closed
            </span>
          )}
          {tempClosed.length > 0 && (
            <span class="badge badge-yellow">
              {tempClosed.length} temp.&nbsp;closed
            </span>
          )}
          {notFound.length > 0 && (
            <span class="badge badge-gray">
              {notFound.length} not&nbsp;found
            </span>
          )}
        </div>
      </div>

      {/* Problems detail */}
      {problems.length > 0 && (
        <div class="section">
          <div class="section-title">Problems ({problems.length})</div>
          {problems.map((p) => (
            <div class="list-item" key={p.mapsUrl}>
              <span>{p.name}</span>
              <span class={statusBadgeClass(p.status)}>
                {statusLabel(p.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <div class="section">
          <div class="section-title">Categories</div>
          {categoryBreakdown.map(([cat, count]) => (
            <div class="list-item" key={cat}>
              <span>{cat}</span>
              <span class="muted">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Move plan */}
      {suggestedMoves.length > 0 && (
        <div class="section">
          <div class="flex items-center justify-between">
            <div class="section-title">
              Move Plan ({selected.size}/{suggestedMoves.length})
            </div>
            <div class="flex gap-8">
              <button
                class="btn btn-sm"
                onClick={() =>
                  setSelected(
                    new Set(suggestedMoves.map((op) => op.mapsUrl)),
                  )
                }
              >
                All
              </button>
              <button
                class="btn btn-sm"
                onClick={() => setSelected(new Set())}
              >
                None
              </button>
            </div>
          </div>

          {suggestedMoves.map((op) => (
            <div class="checkbox-row" key={op.mapsUrl}>
              <input
                type="checkbox"
                checked={selected.has(op.mapsUrl)}
                onChange={() => toggle(op.mapsUrl)}
              />
              <div>
                <div>{op.placeName}</div>
                <div class="muted">
                  {op.sourceList} &rarr; {op.targetList}
                </div>
              </div>
            </div>
          ))}

          <button
            class="btn btn-primary btn-block mt-8"
            onClick={handleExecute}
            disabled={selected.size === 0}
          >
            Execute {selected.size} Move{selected.size !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* Export */}
      <div class="flex gap-8">
        <button class="btn" style={{ flex: 1 }} onClick={handleCopyMarkdown}>
          Copy Markdown
        </button>
        <button
          class="btn"
          style={{ flex: 1 }}
          onClick={handleDownloadMarkdown}
        >
          Download .md
        </button>
      </div>
    </div>
  );
}
