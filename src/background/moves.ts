// Move executor: sends batched move operations to the interests content script,
// logs results to IndexedDB, and broadcasts progress to the popup.

import { logMove } from "@shared/db";
import { sendToTab } from "@shared/messages";
import type { MovePlacesResultMsg } from "@shared/messages";
import type { MoveOperation, MoveResult } from "@shared/types";
import { findOrCreateTab, waitForTabLoad } from "./tabs";

const INTERESTS_URL_PATTERNS = [
  "*://www.google.com/interests/saved*",
  "*://www.google.com/saved/*",
];
const INTERESTS_URL = "https://www.google.com/interests/saved";

/**
 * Group move operations by target list so the content script can process
 * each batch without switching context repeatedly.
 */
function groupByTargetList(
  operations: MoveOperation[],
): Map<string, MoveOperation[]> {
  const groups = new Map<string, MoveOperation[]>();
  for (const op of operations) {
    const existing = groups.get(op.targetList);
    if (existing) {
      existing.push(op);
    } else {
      groups.set(op.targetList, [op]);
    }
  }
  return groups;
}

/**
 * Execute a set of move operations via the interests page content script.
 *
 * Operations are grouped by target list and sent batch-by-batch.
 * Each batch's result is logged to IndexedDB's move log.
 * Progress updates are broadcast to the popup after each batch.
 */
export async function executeMoves(
  operations: MoveOperation[],
): Promise<MoveResult> {
  if (operations.length === 0) {
    return { success: true, errors: [] };
  }

  const tabId = await findOrCreateTab(INTERESTS_URL_PATTERNS, INTERESTS_URL);
  await waitForTabLoad(tabId);

  const groups = groupByTargetList(operations);
  const allErrors: string[] = [];
  let done = 0;
  const total = operations.length;

  for (const [, batch] of groups) {
    const result = await sendToTab<MovePlacesResultMsg>(tabId, {
      type: "MOVE_PLACES",
      operations: batch,
    });

    if (!result.success) {
      allErrors.push(...result.errors);
    }

    // Log each operation in this batch
    const now = Date.now();
    for (const op of batch) {
      await logMove({
        ...op,
        executedAt: now,
        success: result.success,
      });
    }

    done += batch.length;

    // Broadcast per-batch progress to popup
    try {
      await browser.runtime.sendMessage({
        type: "MOVE_PROGRESS",
        done,
        total,
      });
    } catch {
      // Popup not open
    }
  }

  return {
    success: allErrors.length === 0,
    errors: allErrors,
  };
}
