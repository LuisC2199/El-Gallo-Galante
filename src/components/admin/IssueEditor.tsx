// ---------------------------------------------------------------------------
// Admin – Issue editor (frontmatter form + editorial body)
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback } from "react";
import type {
  FilePayload,
  SavePostResponse,
  CollectionItemSummary,
  CreateItemResponse,
  RestoreResponse,
} from "../../lib/admin/types";
import ImageUploadField from "./ImageUploadField";
import ConfirmDialog from "./ConfirmDialog";
import HistoryPanel from "./HistoryPanel";
import {
  Field,
  fieldClass,
  toDateInput,
  EditorTopBar,
  LoadingMessage,
  ErrorMessage,
} from "./EditorFields";

// ---- Props ----

interface IssueEditorProps {
  slug: string;
  onDirtyChange?: (dirty: boolean) => void;
  onDelete?: () => void;
  onDuplicate?: (newSlug: string) => void;
}

// ---- Validation ----

interface ValidationErrors {
  title?: string;
  date?: string;
}

function validate(fm: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!fm.title || String(fm.title).trim() === "") errors.title = "Title is required";
  if (!fm.date || String(fm.date).trim() === "") errors.date = "Date is required";
  return errors;
}

function hasErrors(v: ValidationErrors): boolean {
  return Object.keys(v).length > 0;
}

// ---- Component ----

export default function IssueEditor({ slug, onDirtyChange, onDelete, onDuplicate }: IssueEditorProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>({});
  const [body, setBody] = useState("");
  const [path, setPath] = useState("");
  const [sha, setSha] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showValidation, setShowValidation] = useState(false);

  const [dirty, setDirtyInternal] = useState(false);
  const setDirty = useCallback(
    (value: boolean) => {
      setDirtyInternal(value);
      onDirtyChange?.(value);
    },
    [onDirtyChange],
  );

  // Actions state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Posts list for featuredPostSlugs picker
  const [posts, setPosts] = useState<CollectionItemSummary[]>([]);

  // ---- Load issue + posts list ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setSaveSuccess(false);
    setShowValidation(false);
    setDirty(false);

    async function load() {
      try {
        const [issueRes, postsRes] = await Promise.all([
          fetch(`/api/admin/issues/${encodeURIComponent(slug)}`),
          fetch("/api/admin/posts"),
        ]);

        if (!issueRes.ok) throw new Error(`HTTP ${issueRes.status}`);
        const data: FilePayload = await issueRes.json();

        const postList: CollectionItemSummary[] = postsRes.ok
          ? await postsRes.json()
          : [];

        if (!cancelled) {
          setFrontmatter(data.frontmatter);
          setBody(data.body);
          setPath(data.path);
          setSha(data.sha);
          setPosts(postList);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load issue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // ---- Field updaters ----
  const updateField = useCallback(
    (key: string, value: unknown) => {
      setFrontmatter((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
      setSaveSuccess(false);
      setSaveError(null);
      if (showValidation) {
        setValidationErrors((prev) => {
          const next = { ...prev };
          delete (next as Record<string, string | undefined>)[key];
          return next;
        });
      }
    },
    [showValidation, setDirty],
  );

  const updateBody = useCallback(
    (value: string) => {
      setBody(value);
      setDirty(true);
      setSaveSuccess(false);
      setSaveError(null);
    },
    [setDirty],
  );

  // ---- Featured post slugs helpers ----
  const featuredSlugs: string[] = Array.isArray(frontmatter.featuredPostSlugs)
    ? (frontmatter.featuredPostSlugs as string[])
    : [];

  const toggleFeatured = useCallback(
    (postSlug: string) => {
      setFrontmatter((prev) => {
        const current: string[] = Array.isArray(prev.featuredPostSlugs)
          ? [...(prev.featuredPostSlugs as string[])]
          : [];
        const idx = current.indexOf(postSlug);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(postSlug);
        }
        return { ...prev, featuredPostSlugs: current.length > 0 ? current : undefined };
      });
      setDirty(true);
      setSaveSuccess(false);
      setSaveError(null);
    },
    [setDirty],
  );

  const moveFeatured = useCallback(
    (postSlug: string, direction: -1 | 1) => {
      setFrontmatter((prev) => {
        const current: string[] = Array.isArray(prev.featuredPostSlugs)
          ? [...(prev.featuredPostSlugs as string[])]
          : [];
        const idx = current.indexOf(postSlug);
        if (idx < 0) return prev;
        const target = idx + direction;
        if (target < 0 || target >= current.length) return prev;
        [current[idx], current[target]] = [current[target], current[idx]];
        return { ...prev, featuredPostSlugs: current };
      });
      setDirty(true);
      setSaveSuccess(false);
      setSaveError(null);
    },
    [setDirty],
  );

  // ---- Save ----
  const handleSave = useCallback(async () => {
    const errors = validate(frontmatter);
    setValidationErrors(errors);
    setShowValidation(true);

    if (hasErrors(errors)) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/admin/issues/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, sha, frontmatter, body }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error: string }).error);
      }

      const result: SavePostResponse = await res.json();
      setSha(result.sha);
      setDirty(false);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [frontmatter, body, path, sha, slug, setDirty]);

  // ---- Delete ----
  const handleDelete = useCallback(async () => {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/admin/issues/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error: string }).error);
      }
      setShowDeleteConfirm(false);
      onDelete?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Delete failed");
      setShowDeleteConfirm(false);
    } finally {
      setActionBusy(false);
    }
  }, [slug, sha, onDelete]);

  // ---- Duplicate ----
  const handleDuplicate = useCallback(async () => {
    setActionBusy(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/issues/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error: string }).error);
      }
      const result: CreateItemResponse = await res.json();
      onDuplicate?.(result.slug);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setActionBusy(false);
    }
  }, [slug, onDuplicate]);

  // ---- Render ----

  if (loading) return <LoadingMessage />;
  if (loadError) return <ErrorMessage text={loadError} />;

  const fm = frontmatter;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <EditorTopBar
        path={path}
        sha={sha}
        dirty={dirty}
        saving={saving}
        saveSuccess={saveSuccess}
        saveError={saveError}
        onSave={handleSave}
        extra={
          <>
            <button
              onClick={() => setShowHistory(true)}
              disabled={actionBusy || saving}
              className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 disabled:opacity-50 transition-colors"
              title="View version history"
            >
              History
            </button>
            <button
              onClick={handleDuplicate}
              disabled={actionBusy || saving}
              className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 disabled:opacity-50 transition-colors"
              title="Duplicate this issue"
            >
              Duplicate
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionBusy || saving}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
              title="Delete this issue"
            >
              Delete
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          {/* ---- Core fields ---- */}
          <section className="mb-8 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Issue info
            </h3>

            <Field label="Title" error={showValidation ? validationErrors.title : undefined}>
              <input
                type="text"
                value={String(fm.title ?? "")}
                onChange={(e) => updateField("title", e.target.value)}
                className={fieldClass(showValidation && !!validationErrors.title)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" error={showValidation ? validationErrors.date : undefined}>
                <input
                  type="date"
                  value={toDateInput(fm.date)}
                  onChange={(e) => {
                    const d = e.target.value;
                    updateField("date", d ? `${d}T00:00:00.000Z` : "");
                  }}
                  className={fieldClass(showValidation && !!validationErrors.date)}
                />
              </Field>

              <Field label="Number" hint='e.g. "No. 01"'>
                <input
                  type="text"
                  value={String(fm.number ?? "")}
                  onChange={(e) => updateField("number", e.target.value || undefined)}
                  placeholder="No. 01"
                  className={fieldClass()}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={String(fm.description ?? "")}
                onChange={(e) => updateField("description", e.target.value || undefined)}
                rows={3}
                className={fieldClass() + " resize-y"}
              />
            </Field>

            <Field label="Cover Image">
              <ImageUploadField
                value={String(fm.coverImage ?? "")}
                onChange={(v) => updateField("coverImage", v || undefined)}
                target="covers"
                placeholder="/covers/issue-cover.jpg"
              />
            </Field>
          </section>

          {/* ---- Featured posts ---- */}
          <section className="mb-8">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Featured posts
            </h3>

            {/* Currently selected — ordered list */}
            {featuredSlugs.length > 0 && (
              <div className="mb-4 space-y-1">
                {featuredSlugs.map((s, i) => {
                  const post = posts.find((p) => p.slug === s);
                  return (
                    <div
                      key={s}
                      className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-md text-sm"
                    >
                      <span className="text-xs text-stone-400 font-mono w-5 shrink-0">
                        {i + 1}.
                      </span>
                      <span className="flex-1 truncate text-stone-800">
                        {post?.title ?? s}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveFeatured(s, -1)}
                        disabled={i === 0}
                        className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-30"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFeatured(s, 1)}
                        disabled={i === featuredSlugs.length - 1}
                        className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFeatured(s)}
                        className="text-xs text-red-400 hover:text-red-600"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add from all posts */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors select-none">
                Add posts…
              </summary>
              <div className="mt-2 max-h-60 overflow-y-auto border border-stone-200 rounded-md divide-y divide-stone-100">
                {posts
                  .filter((p) => !featuredSlugs.includes(p.slug))
                  .map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => toggleFeatured(p.slug)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 transition-colors"
                    >
                      <span className="text-stone-800">{p.title ?? p.slug}</span>
                      {p.date && (
                        <span className="ml-2 text-xs text-stone-400">
                          {new Date(p.date).toLocaleDateString("es-MX", {
                            year: "numeric",
                            month: "short",
                          })}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </details>
          </section>

          {/* ---- Editorial note (body) ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Editorial note
            </h3>
            <textarea
              value={body}
              onChange={(e) => updateBody(e.target.value)}
              rows={8}
              className={fieldClass() + " resize-y font-mono text-xs leading-relaxed"}
              placeholder="Optional editorial note in Markdown…"
            />
          </section>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete issue"
          message={`Are you sure you want to delete "${frontmatter.title ?? slug}"?\n\nThis action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          busy={actionBusy}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showHistory && (
        <HistoryPanel
          slug={slug}
          collection="issues"
          currentSha={sha}
          busy={actionBusy || saving}
          onClose={() => setShowHistory(false)}
          onRestore={(result: RestoreResponse) => {
            setFrontmatter(result.frontmatter);
            setBody(result.body);
            setSha(result.sha);
            setDirty(false);
            setSaveSuccess(false);
            setShowHistory(false);
          }}
        />
      )}
    </div>
  );
}
