import { h } from "preact";
import type { MoveResult } from "@shared/types";

interface MoveExecutorProps {
  done: number;
  total: number;
  result: MoveResult | null;
  onBack: () => void;
}

export function MoveExecutor({
  done,
  total,
  result,
  onBack,
}: MoveExecutorProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = result !== null;

  return (
    <div class="flex-col gap-12">
      <div class="section">
        <div class="section-title">
          {isComplete ? "Moves Complete" : "Executing Moves\u2026"}
        </div>

        <div class="progress-bar">
          <div class="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <div class="muted mt-8">
          {done} / {total} ({pct}%)
        </div>
      </div>

      {result && (
        <div class="section">
          {result.success ? (
            <span class="badge badge-green">All moves successful</span>
          ) : (
            <div>
              <span class="badge badge-red">
                {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
              </span>
              <div class="mt-8">
                {result.errors.map((err, i) => (
                  <div
                    class="error-text"
                    key={i}
                    style={{ marginBottom: "4px" }}
                  >
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isComplete && (
        <button class="btn btn-block" onClick={onBack}>
          Back to Dashboard
        </button>
      )}
    </div>
  );
}
