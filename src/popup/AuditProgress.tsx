import { h } from "preact";
import type { AuditProgress } from "@shared/types";

interface AuditProgressViewProps {
  progress: AuditProgress;
  onPause: () => void;
  onResume: () => void;
}

const STATE_LABELS: Record<string, string> = {
  running: "Auditing\u2026",
  paused: "Paused",
  error: "Error",
  done: "Complete",
  idle: "Idle",
};

export function AuditProgressView({
  progress,
  onPause,
  onResume,
}: AuditProgressViewProps) {
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div class="flex-col gap-12">
      <div class="section">
        <div class="section-title">
          {STATE_LABELS[progress.state] ?? progress.state}
        </div>

        <div class="progress-bar">
          <div class="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <div class="muted mt-8">
          {progress.current} / {progress.total} places checked ({pct}%)
        </div>

        {progress.currentPlaceName && (
          <div class="muted mt-4">Checking: {progress.currentPlaceName}</div>
        )}
      </div>

      <div class="flex gap-8">
        {progress.state === "running" && (
          <button class="btn" onClick={onPause}>
            Pause
          </button>
        )}
        {progress.state === "paused" && (
          <button class="btn btn-primary" onClick={onResume}>
            Resume
          </button>
        )}
      </div>
    </div>
  );
}
