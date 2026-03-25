// ---------------------------------------------------------------------------
// Admin – Version history panel (modal overlay)
// ---------------------------------------------------------------------------
//
// Shows commit history for a file.  Allows viewing a past version
// (read-only) and restoring it via a new commit.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react";
import type {
  CommitEntry,
  FileHistoryResponse,
  FileAtCommitResponse,
  RestoreResponse,
} from "../../lib/admin/types";

type Collection = "posts" | "authors" | "issues";

interface HistoryPanelProps {
  slug: string;
  collection: Collection;
  /** Current blob SHA – needed for safe restore. */
  currentSha: string;
  onClose: () => void;
  /** Called after a successful restore with the new file state. */
  onRestore: (result: RestoreResponse) => void;
  /** Whether an external action (save/delete) is in progress. */
  busy?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HistoryPanel({
  slug,
  collection,
  currentSha,
  onClose,
  onRestore,
  busy = false,
}: HistoryPanelProps) {
  // ---- State ----
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [selectedCommit, setSelectedCommit] = useState<CommitEntry | null>(null);
  const [versionData, setVersionData] = useState<FileAtCommitResponse | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // ---- Fetch commit history on mount ----
  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError(null);

    const qs = new URLSearchParams({ collection, slug });
    fetch(`/api/admin/history?${qs}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error((err as { error: string }).error);
        }
        return res.json() as Promise<FileHistoryResponse>;
      })
      .then((data) => {
        if (!cancelled) setCommits(data.commits);
      })
      .catch((err) => {
        if (!cancelled)
          setHistoryError(err instanceof Error ? err.message : "Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => { cancelled = true; };
  }, [collection, slug]);

  // ---- View a past version ----
  const handleSelectCommit = useCallback(
    (commit: CommitEntry) => {
      if (commit.sha === selectedCommit?.sha) {
        // Toggle off
        setSelectedCommit(null);
        setVersionData(null);
        setVersionError(null);
        return;
      }

      setSelectedCommit(commit);
      setVersionData(null);
      setVersionError(null);
      setLoadingVersion(true);
      setShowRestoreConfirm(false);
      setRestoreError(null);

      const qs = new URLSearchParams({ collection, slug, commitSha: commit.sha });
      fetch(`/api/admin/history/version?${qs}`)
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error((err as { error: string }).error);
          }
          return res.json() as Promise<FileAtCommitResponse>;
        })
        .then((data) => setVersionData(data))
        .catch((err) =>
          setVersionError(err instanceof Error ? err.message : "Failed to load version"),
        )
        .finally(() => setLoadingVersion(false));
    },
    [collection, slug, selectedCommit],
  );

  // ---- Restore ----
  const handleRestore = useCallback(async () => {
    if (!selectedCommit) return;
    setRestoring(true);
    setRestoreError(null);

    try {
      const res = await fetch("/api/admin/history/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection,
          slug,
          sha: currentSha,
          commitSha: selectedCommit.sha,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error: string }).error);
      }

      const result: RestoreResponse = await res.json();
      onRestore(result);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
      setShowRestoreConfirm(false);
    }
  }, [selectedCommit, collection, slug, currentSha, onRestore]);

  // ---- Render ----

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget && !restoring) onClose();
      }}
    >
      {/* Side panel */}
      <div className="w-full max-w-2xl bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-800">Version history</h2>
          <button
            onClick={onClose}
            disabled={restoring}
            className="text-stone-400 hover:text-stone-600 text-lg leading-none disabled:opacity-50"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Commit list */}
          <div className="w-64 shrink-0 border-r border-stone-200 overflow-y-auto">
            {loadingHistory && (
              <p className="p-4 text-xs text-stone-400">Loading history…</p>
            )}
            {historyError && (
              <p className="p-4 text-xs text-red-600">{historyError}</p>
            )}
            {!loadingHistory && !historyError && commits.length === 0 && (
              <p className="p-4 text-xs text-stone-400">No history found.</p>
            )}
            {commits.map((c, i) => (
              <button
                key={c.sha}
                onClick={() => handleSelectCommit(c)}
                className={`w-full text-left px-4 py-3 border-b border-stone-100 transition-colors ${
                  selectedCommit?.sha === c.sha
                    ? "bg-stone-100"
                    : "hover:bg-stone-50"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-mono text-stone-400">
                    {c.sha.slice(0, 7)}
                  </span>
                  {i === 0 && (
                    <span className="text-[10px] font-medium text-emerald-600 shrink-0">
                      latest
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-700 mt-0.5 line-clamp-2">
                  {c.message}
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {c.authorName} · {relativeTime(c.date)}
                </p>
              </button>
            ))}
          </div>

          {/* Version preview */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedCommit && (
              <p className="text-sm text-stone-400 text-center mt-12">
                Select a version from the list to preview it.
              </p>
            )}

            {selectedCommit && loadingVersion && (
              <p className="text-sm text-stone-400 text-center mt-12">
                Loading version…
              </p>
            )}

            {selectedCommit && versionError && (
              <p className="text-sm text-red-600 text-center mt-12">
                {versionError}
              </p>
            )}

            {selectedCommit && versionData && (
              <div>
                {/* Version info bar */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500">
                      <span className="font-mono">{selectedCommit.sha.slice(0, 7)}</span>
                      {" · "}
                      {formatDate(selectedCommit.date)}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {selectedCommit.authorName}: {selectedCommit.message}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRestoreConfirm(true)}
                    disabled={restoring || busy}
                    className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 disabled:opacity-50 transition-colors"
                  >
                    Restore this version
                  </button>
                </div>

                {restoreError && (
                  <p className="mb-3 text-xs text-red-600">{restoreError}</p>
                )}

                {/* Frontmatter */}
                <div className="mb-4">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                    Frontmatter
                  </h4>
                  <pre className="text-xs font-mono bg-stone-50 border border-stone-200 rounded p-3 overflow-x-auto whitespace-pre-wrap text-stone-600 max-h-64 overflow-y-auto">
                    {JSON.stringify(versionData.frontmatter, null, 2)}
                  </pre>
                </div>

                {/* Body */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                    Body
                  </h4>
                  <pre className="text-xs font-mono bg-stone-50 border border-stone-200 rounded p-3 overflow-x-auto whitespace-pre-wrap text-stone-600 max-h-96 overflow-y-auto">
                    {versionData.body || "(empty)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restore confirmation overlay */}
      {showRestoreConfirm && selectedCommit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-stone-800 mb-2">
              Restore version?
            </h3>
            <p className="text-sm text-stone-600 mb-1">
              This will overwrite the current file with the version from:
            </p>
            <p className="text-sm font-mono text-stone-500 mb-1">
              {selectedCommit.sha.slice(0, 7)} · {formatDate(selectedCommit.date)}
            </p>
            <p className="text-xs text-stone-400 mb-4">
              A new commit will be created. You can undo this by restoring again.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                disabled={restoring}
                className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="px-4 py-2 text-sm font-medium bg-stone-800 text-white rounded hover:bg-stone-700 disabled:opacity-50 transition-colors"
              >
                {restoring ? "Restoring…" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
