// ---------------------------------------------------------------------------
// Admin – Author editor (frontmatter form + biography body)
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback } from "react";
import type { FilePayload, SavePostResponse, CreateItemResponse, RestoreResponse } from "../../lib/admin/types";
import ImageUploadField from "./ImageUploadField";
import ConfirmDialog from "./ConfirmDialog";
import HistoryPanel from "./HistoryPanel";
import {
  Field,
  fieldClass,
  EditorTopBar,
  LoadingMessage,
  ErrorMessage,
} from "./EditorFields";

// ---- Props ----

interface AuthorEditorProps {
  slug: string;
  onDirtyChange?: (dirty: boolean) => void;
  onDelete?: () => void;
  onDuplicate?: (newSlug: string) => void;
}

// ---- Validation ----

interface ValidationErrors {
  name?: string;
}

function validate(fm: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!fm.name || String(fm.name).trim() === "") errors.name = "Name is required";
  return errors;
}

function hasErrors(v: ValidationErrors): boolean {
  return Object.keys(v).length > 0;
}

// ---- Component ----

export default function AuthorEditor({ slug, onDirtyChange, onDelete, onDuplicate }: AuthorEditorProps) {
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

  // ---- Load author ----
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
        const res = await fetch(`/api/admin/authors/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FilePayload = await res.json();
        if (!cancelled) {
          setFrontmatter(data.frontmatter);
          setBody(data.body);
          setPath(data.path);
          setSha(data.sha);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load author");
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

  const updateSocial = useCallback(
    (key: string, value: string) => {
      setFrontmatter((prev) => {
        const social = (prev.social ?? {}) as Record<string, unknown>;
        return { ...prev, social: { ...social, [key]: value || undefined } };
      });
      setDirty(true);
      setSaveSuccess(false);
      setSaveError(null);
    },
    [setDirty],
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
      const res = await fetch(`/api/admin/authors/${encodeURIComponent(slug)}`, {
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
      const res = await fetch(`/api/admin/authors/${encodeURIComponent(slug)}`, {
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
      const res = await fetch("/api/admin/authors/duplicate", {
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
  const social = (fm.social ?? {}) as Record<string, unknown>;

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
              Historial
            </button>
            <button
              onClick={handleDuplicate}
              disabled={actionBusy || saving}
              className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 disabled:opacity-50 transition-colors"
              title="Duplicate this author"
            >
              Duplicar
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionBusy || saving}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
              title="Delete this author"
            >
              Eliminar
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          {/* ---- Core fields ---- */}
          <section className="mb-8 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Información del autor
            </h3>

            <Field label="Nombre" error={showValidation ? validationErrors.name : undefined}>
              <input
                type="text"
                value={String(fm.name ?? "")}
                onChange={(e) => updateField("name", e.target.value)}
                className={fieldClass(showValidation && !!validationErrors.name)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Año de nacimiento" hint="Opcional año de defunción en mismo campo">
                <input
                  type="text"
                  value={String(fm.birthYear ?? "")}
                  onChange={(e) => updateField("birthYear", e.target.value || undefined)}
                  placeholder="e.g. 1986"
                  className={fieldClass()}
                />
              </Field>

              <Field label="Lugar de nacimiento">
                <input
                  type="text"
                  value={String(fm.birthPlace ?? "")}
                  onChange={(e) => updateField("birthPlace", e.target.value || undefined)}
                  placeholder="e.g. Jalisco"
                  className={fieldClass()}
                />
              </Field>
            </div>

            <Field label="Género" hint="true = male, false = female, empty = unspecified">
              <select
                value={fm.gender === true ? "true" : fm.gender === false ? "false" : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  updateField("gender", v === "" ? undefined : v === "true");
                }}
                className={fieldClass()}
              >
                
                <option value="true">Male</option>
                <option value="false">Female</option>
                <option value="">No especificado</option>
              </select>
            </Field>

            <Field label="Foto">
              <ImageUploadField
                value={String(fm.photo ?? "")}
                onChange={(v) => updateField("photo", v || undefined)}
                target="authors"
                placeholder="/authors/photo.jpg"
              />
            </Field>
          </section>

          {/* ---- Social links ---- */}
          <section className="mb-8 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Redes sociales
            </h3>

            {(["website", "instagram", "x", "facebook", "tiktok"] as const).map((key) => (
              <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
                <input
                  type="text"
                  value={String(social[key] ?? "")}
                  onChange={(e) => updateSocial(key, e.target.value)}
                  placeholder={key === "website" ? "https://…" : `@usuario or URL`}
                  className={fieldClass()}
                />
              </Field>
            ))}
          </section>

          {/* ---- Biography (markdown body) ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Semblanza
            </h3>
            <textarea
              value={body}
              onChange={(e) => updateBody(e.target.value)}
              rows={10}
              className={fieldClass() + " resize-y font-mono text-xs leading-relaxed"}
              placeholder="Author biography in Markdown…"
            />
          </section>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete author"
          message={`Are you sure you want to delete "${frontmatter.name ?? slug}"?\n\nThis action cannot be undone.`}
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
          collection="authors"
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
