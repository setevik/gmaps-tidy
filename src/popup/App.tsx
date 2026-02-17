import { h } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import { sendToBackground } from "@shared/messages";
import type {
  AuditProgressMsg,
  BackgroundToPopupMsg,
  SyncListsResultMsg,
} from "@shared/messages";
import type {
  AuditProgress,
  CategoryMapping,
  MoveOperation,
  MoveResult,
  Place,
  SavedList,
} from "@shared/types";
import { getLists, getPlacesByList, getConfig } from "@shared/db";
import {
  DEFAULT_CATEGORY_MAPPINGS,
  DEFAULT_FALLBACK_LIST,
} from "@shared/config";
import { Dashboard } from "./Dashboard";
import { AuditProgressView } from "./AuditProgress";
import { Report } from "./Report";
import { MoveExecutor } from "./MoveExecutor";
import "./popup.css";

type View = "dashboard" | "auditing" | "report" | "moving";

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [lists, setLists] = useState<SavedList[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [selectedList, setSelectedList] = useState("");
  const [auditProgress, setAuditProgress] = useState<AuditProgress>({
    state: "idle",
    current: 0,
    total: 0,
    currentPlaceName: null,
  });
  const [auditedPlaces, setAuditedPlaces] = useState<Place[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>(
    DEFAULT_CATEGORY_MAPPINGS,
  );
  const [fallbackList, setFallbackList] = useState(DEFAULT_FALLBACK_LIST);
  const [moveResult, setMoveResult] = useState<MoveResult | null>(null);
  const [moveDone, setMoveDone] = useState(0);
  const [moveTotal, setMoveTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Load initial state on popup open ──────────────────────────────

  useEffect(() => {
    (async () => {
      // Load cached lists
      const savedLists = await getLists();
      setLists(savedLists);
      if (savedLists.length > 0) {
        setSelectedList(savedLists[0].name);
      }

      // Load user config (mappings / fallback)
      const mappings = await getConfig("categoryMappings");
      if (mappings) setCategoryMappings(mappings);
      const fb = await getConfig("fallbackList");
      if (fb) setFallbackList(fb);

      // Restore view from current audit state
      const resp = await sendToBackground<AuditProgressMsg>({
        type: "GET_AUDIT_PROGRESS",
      });
      setAuditProgress(resp.progress);

      if (
        resp.progress.state === "running" ||
        resp.progress.state === "paused"
      ) {
        setView("auditing");
      } else if (resp.progress.state === "done") {
        const auditState = await getConfig("auditState");
        if (auditState) {
          const places = await getPlacesByList(auditState.listName);
          setAuditedPlaces(places);
          setSelectedList(auditState.listName);
          setView("report");
        }
      }
    })();
  }, []);

  // ── Listen for push messages from background ──────────────────────

  useEffect(() => {
    function onMessage(msg: BackgroundToPopupMsg) {
      switch (msg.type) {
        case "AUDIT_PROGRESS":
          setAuditProgress(msg.progress);
          if (msg.progress.state === "error") {
            setError("Audit encountered an error");
          }
          break;
        case "AUDIT_COMPLETE":
          setAuditProgress({
            state: "done",
            current: msg.places.length,
            total: msg.places.length,
            currentPlaceName: null,
          });
          setAuditedPlaces(msg.places);
          setView("report");
          break;
        case "MOVE_PROGRESS":
          setMoveDone(msg.done);
          setMoveTotal(msg.total);
          break;
        case "MOVE_COMPLETE":
          setMoveResult(msg.results);
          break;
      }
    }

    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const resp = await sendToBackground<SyncListsResultMsg>({
        type: "SYNC_LISTS",
      });
      setLists(resp.lists);
      if (resp.lists.length > 0 && !selectedList) {
        setSelectedList(resp.lists[0].name);
      }
    } catch (err) {
      setError(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  }, [selectedList]);

  const handleStartAudit = useCallback(async () => {
    if (!selectedList) return;
    setError(null);
    setView("auditing");
    setAuditProgress({
      state: "running",
      current: 0,
      total: 0,
      currentPlaceName: null,
    });
    await sendToBackground({
      type: "START_AUDIT",
      listName: selectedList,
    });
  }, [selectedList]);

  const handlePause = useCallback(async () => {
    await sendToBackground({ type: "PAUSE_AUDIT" });
  }, []);

  const handleResume = useCallback(async () => {
    await sendToBackground({ type: "RESUME_AUDIT" });
  }, []);

  const handleExecuteMoves = useCallback(
    async (ops: MoveOperation[]) => {
      setMoveDone(0);
      setMoveTotal(ops.length);
      setMoveResult(null);
      setView("moving");
      await sendToBackground({ type: "EXECUTE_MOVES", operations: ops });
    },
    [],
  );

  const handleBackToDashboard = useCallback(() => {
    setView("dashboard");
    setAuditProgress({
      state: "idle",
      current: 0,
      total: 0,
      currentPlaceName: null,
    });
    setAuditedPlaces([]);
    setMoveResult(null);
    setError(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div>
      <div class="header">
        <h1>gmaps-tidy</h1>
        {view !== "dashboard" && (
          <button class="btn btn-sm" onClick={handleBackToDashboard}>
            Dashboard
          </button>
        )}
      </div>

      <div class="content">
        {error && <p class="error-text mb-8">{error}</p>}

        {view === "dashboard" && (
          <Dashboard
            lists={lists}
            selectedList={selectedList}
            onSelectList={setSelectedList}
            onSync={handleSync}
            syncing={syncing}
            onStartAudit={handleStartAudit}
          />
        )}

        {view === "auditing" && (
          <AuditProgressView
            progress={auditProgress}
            onPause={handlePause}
            onResume={handleResume}
          />
        )}

        {view === "report" && (
          <Report
            places={auditedPlaces}
            listName={selectedList}
            categoryMappings={categoryMappings}
            fallbackList={fallbackList}
            onExecuteMoves={handleExecuteMoves}
          />
        )}

        {view === "moving" && (
          <MoveExecutor
            done={moveDone}
            total={moveTotal}
            result={moveResult}
            onBack={handleBackToDashboard}
          />
        )}
      </div>
    </div>
  );
}
