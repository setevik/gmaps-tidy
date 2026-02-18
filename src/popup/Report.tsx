import { h } from "preact";
import { useState, useMemo } from "preact/hooks";
import type { CategoryMapping, MoveOperation, Place } from "@shared/types";
import { analyzeAudit, generateMarkdownReport } from "@shared/report";
import { copyToClipboard, downloadFile, toFilename } from "@shared/export";

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
  const reportInput = useMemo(
    () => ({ listName, places, categoryMappings, fallbackList }),
    [listName, places, categoryMappings, fallbackList],
  );

  const data = useMemo(() => analyzeAudit(reportInput), [reportInput]);

  // Checkbox state — all selected by default
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(data.suggestedMoves.map((op) => op.mapsUrl)),
  );

  const [copyLabel, setCopyLabel] = useState("Copy Markdown");

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function handleExecute() {
    const ops = data.suggestedMoves.filter((op) => selected.has(op.mapsUrl));
    if (ops.length > 0) onExecuteMoves(ops);
  }

  async function handleCopyMarkdown() {
    const md = generateMarkdownReport(reportInput, data);
    const ok = await copyToClipboard(md);
    setCopyLabel(ok ? "Copied!" : "Copy failed");
    setTimeout(() => setCopyLabel("Copy Markdown"), 2000);
  }

  function handleDownloadMarkdown() {
    const md = generateMarkdownReport(reportInput, data);
    downloadFile(toFilename(`audit-${listName}`), md);
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div class="flex-col gap-12">
      {/* Summary badges */}
      <div class="section">
        <div class="section-title">Audit Complete &mdash; {listName}</div>
        <div class="flex gap-8 flex-wrap">
          <span class="badge badge-green">{data.healthy.length} open</span>
          {data.permClosed.length > 0 && (
            <span class="badge badge-red">
              {data.permClosed.length} perm.&nbsp;closed
            </span>
          )}
          {data.tempClosed.length > 0 && (
            <span class="badge badge-yellow">
              {data.tempClosed.length} temp.&nbsp;closed
            </span>
          )}
          {data.notFound.length > 0 && (
            <span class="badge badge-gray">
              {data.notFound.length} not&nbsp;found
            </span>
          )}
        </div>
      </div>

      {/* Problems detail */}
      {data.problems.length > 0 && (
        <div class="section">
          <div class="section-title">Problems ({data.problems.length})</div>
          {data.problems.map((p) => (
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
      {data.categoryBreakdown.length > 0 && (
        <div class="section">
          <div class="section-title">Categories</div>
          {data.categoryBreakdown.map(([cat, count]) => (
            <div class="list-item" key={cat}>
              <span>{cat}</span>
              <span class="muted">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Move plan */}
      {data.suggestedMoves.length > 0 && (
        <div class="section">
          <div class="flex items-center justify-between">
            <div class="section-title">
              Move Plan ({selected.size}/{data.suggestedMoves.length})
            </div>
            <div class="flex gap-8">
              <button
                class="btn btn-sm"
                onClick={() =>
                  setSelected(
                    new Set(data.suggestedMoves.map((op) => op.mapsUrl)),
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

          {data.suggestedMoves.map((op) => (
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
          {copyLabel}
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
