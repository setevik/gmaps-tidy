// gmaps-tidy background script (event page)
// Orchestrates audit workflow, manages status-check queue, persists state to IndexedDB.

import type {
  PopupToBackgroundMsg,
  SyncListsResultMsg,
  AuditProgressMsg,
  MoveCompleteMsg,
} from "@shared/messages";
import { syncLists } from "./sync";
import {
  AUDIT_ALARM,
  startAudit,
  pauseAudit,
  resumeAudit,
  getAuditProgress,
  auditTick,
  recoverAuditIfNeeded,
} from "./audit";
import { executeMoves } from "./moves";

// ── Message router ────────────────────────────────────────────────

type MessageResponse =
  | SyncListsResultMsg
  | AuditProgressMsg
  | MoveCompleteMsg
  | { ok: true };

browser.runtime.onMessage.addListener(
  (
    message: PopupToBackgroundMsg,
    _sender: browser.runtime.MessageSender,
  ): Promise<MessageResponse> | undefined => {
    switch (message.type) {
      case "SYNC_LISTS":
        return syncLists().then((lists) => ({
          type: "SYNC_LISTS_RESULT" as const,
          lists,
        }));

      case "START_AUDIT":
        return startAudit(message.listName).then(() => ({ ok: true as const }));

      case "PAUSE_AUDIT":
        return pauseAudit().then(() => ({ ok: true as const }));

      case "RESUME_AUDIT":
        return resumeAudit().then(() => ({ ok: true as const }));

      case "GET_AUDIT_PROGRESS":
        return getAuditProgress().then((progress) => ({
          type: "AUDIT_PROGRESS" as const,
          progress,
        }));

      case "EXECUTE_MOVES":
        return executeMoves(message.operations).then((results) => ({
          type: "MOVE_COMPLETE" as const,
          results,
        }));

      default:
        return undefined;
    }
  },
);

// ── Alarm handler ─────────────────────────────────────────────────

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUDIT_ALARM) {
    auditTick();
  }
});

// ── Lifecycle ─────────────────────────────────────────────────────

browser.runtime.onInstalled.addListener(() => {
  console.log("gmaps-tidy installed");
});

// On startup (browser launch or event page wake), check for an interrupted audit
// and re-schedule the alarm if needed.
browser.runtime.onStartup.addListener(() => {
  recoverAuditIfNeeded();
});

// Also recover on event page wake (covers non-startup cases like extension update).
recoverAuditIfNeeded();
