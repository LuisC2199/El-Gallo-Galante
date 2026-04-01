// ---------------------------------------------------------------------------
// Admin – editable post editor (frontmatter form + body textarea)
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import type {
  FilePayload,
  PostCategory,
  PostStatus,
  SavePostRequest,
  SavePostResponse,
  AuthorSummary,
  IssueSummary,
  CreateItemResponse,
  RestoreResponse,
} from "../../lib/admin/types";
import ImageUploadField from "./ImageUploadField";
import PostPreviewPanel from "./PostPreviewPanel";
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

const MilkdownEditor = lazy(() => import("./MilkdownEditor"));

// ---- Constants ----

const CATEGORIES: PostCategory[] = [
  "Poesía",
  "Narrativa",
  "Crítica",
  "Ensayo",
  "Epistolario",
];

const STATUSES = [
  { value: "draft", label: "Borrador", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "review", label: "En revisión", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "published", label: "Publicado", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

const IMAGE_POSITIONS = ["top", "center", "bottom"] as const;

const IMAGE_POSITION_LABELS: Record<string, string> = {
  top: "Arriba",
  center: "Centro",
  bottom: "Abajo",
};

interface PostEditorProps {
  slug: string;
  /** Called whenever the editor's dirty state changes. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called after the item has been deleted. */
  onDelete?: () => void;
  /** Called after the item has been duplicated, with the new slug. */
  onDuplicate?: (newSlug: string) => void;
}

// ---- Validation ----

interface ValidationErrors {
  title?: string;
  date?: string;
  category?: string;
}

function validate(fm: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!fm.title || String(fm.title).trim() === "") errors.title = "El título es obligatorio";
  if (!fm.date || String(fm.date).trim() === "") errors.date = "La fecha es obligatoria";
  if (!fm.category || String(fm.category).trim() === "") errors.category = "La categoría es obligatoria";
  return errors;
}

function hasErrors(v: ValidationErrors): boolean {
  return Object.keys(v).length > 0;
}

// ---- Component ----

export default function PostEditor({ slug, onDirtyChange, onDelete, onDuplicate }: PostEditorProps) {
  // Remote state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable state
  const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>({});
  const [body, setBody] = useState("");
  const [path, setPath] = useState("");
  const [sha, setSha] = useState("");

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Validation
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showValidation, setShowValidation] = useState(false);

  // Dirty tracking
  const [dirty, setDirtyInternal] = useState(false);

  const setDirty = useCallback(
    (value: boolean) => {
      setDirtyInternal(value);
      onDirtyChange?.(value);
    },
    [onDirtyChange],
  );

  // Relation data for pickers
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [issues, setIssues] = useState<IssueSummary[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  // Actions state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ---- Load relation data (authors + issues) ----
  useEffect(() => {
    fetch("/api/admin/authors")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AuthorSummary[]) => setAuthors(data))
      .catch(() => {});
    fetch("/api/admin/issues")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: IssueSummary[]) => setIssues(data))
      .catch(() => {});
  }, []);

  // ---- Load post ----
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
        const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FilePayload = await res.json();
        if (!cancelled) {
          setFrontmatter(data.frontmatter);
          setBody(data.body);
          setPath(data.path);
          setSha(data.sha);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Error al cargar el post");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // ---- Field updaters ----
  const updateField = useCallback((key: string, value: unknown) => {
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
  }, [showValidation]);

  const updateBody = useCallback((value: string) => {
    setBody(value);
    setDirty(true);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

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
      const payload: SavePostRequest = {
        path,
        sha,
        frontmatter,
        body,
      };

      const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [frontmatter, body, path, sha, slug]);

  // ---- Delete ----
  const handleDelete = useCallback(async () => {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, {
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
      setSaveError(err instanceof Error ? err.message : "Error al eliminar");
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
      const res = await fetch("/api/admin/posts/duplicate", {
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
      setSaveError(err instanceof Error ? err.message : "Error al duplicar");
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
            <div className="flex items-center bg-stone-100 rounded-md p-0.5">
              <button
                onClick={() => setViewMode("edit")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  viewMode === "edit"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Editar
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  viewMode === "preview"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Vista previa
              </button>
            </div>
            <button
              onClick={() => setShowHistory(true)}
              disabled={actionBusy || saving}
              className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 disabled:opacity-50 transition-colors"
              title="Ver historial de versiones"
            >
              Historial
            </button>
            <button
              onClick={handleDuplicate}
              disabled={actionBusy || saving}
              className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 disabled:opacity-50 transition-colors"
              title="Duplicar est publicación"
            >
              Duplicar
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionBusy || saving}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
              title="Eliminar esta publicación"
            >
              Eliminar
            </button>
          </>
        }
      />

      {viewMode === "preview" ? (
        <PostPreviewPanel
          frontmatter={frontmatter}
          body={body}
          authors={authors}
        />
      ) : (
      <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl">
        {/* ---- Frontmatter fields ---- */}
        <section className="mb-8 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
            Información de la publicación
          </h3>

          {/* Title */}
          <Field label="Título" error={showValidation ? validationErrors.title : undefined}>
            <input
              type="text"
              value={String(fm.title ?? "")}
              onChange={(e) => updateField("title", e.target.value)}
              className={fieldClass(showValidation && !!validationErrors.title)}
            />
          </Field>

          {/* Date */}
          <Field label="Fecha" error={showValidation ? validationErrors.date : undefined}>
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

          {/* Category */}
          <Field label="Categoría" error={showValidation ? validationErrors.category : undefined}>
            <select
              value={String(fm.category ?? "")}
              onChange={(e) => updateField("category", e.target.value)}
              className={fieldClass(showValidation && !!validationErrors.category)}
            >
              <option value="">— seleccionar —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          {/* Status */}
          <Field label="Estado">
            <div className="flex items-center gap-3">
              <select
                value={String(fm.status ?? "published")}
                onChange={(e) => updateField("status", e.target.value)}
                className={fieldClass()}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {(() => {
                const current = STATUSES.find((s) => s.value === (fm.status ?? "published"));
                return current ? (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${current.color}`}>
                    {current.label}
                  </span>
                ) : null;
              })()}
            </div>
          </Field>

          {/* Issue */}
          <Field label="Número">
            <select
              value={String(fm.issue ?? "")}
              onChange={(e) => updateField("issue", e.target.value || undefined)}
              className={fieldClass()}
            >
              <option value="">— ninguno —</option>
              {issues.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.number ? `${i.number} — ` : ""}{i.title}
                </option>
              ))}
            </select>
          </Field>

          {/* Author (slug) */}
          <Field label="Autor">
            <select
              value={String(fm.author ?? "")}
              onChange={(e) => updateField("author", e.target.value)}
              className={fieldClass()}
            >
              <option value="">— seleccionar —</option>
              {authors.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Traductor (slug) */}
          <Field label="Traductor" hint="Traductor opcional">
            <select
              value={String(fm.traductor ?? "")}
              onChange={(e) => updateField("traductor", e.target.value || undefined)}
              className={fieldClass()}
            >
              <option value="">— ninguno —</option>
              {authors.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Excerpt */}
          <Field label="Extracto" hint="Extracto para mostrar en la vista previa de la publicación">
            <textarea
              value={String(fm.excerpt ?? "")}
              onChange={(e) => updateField("excerpt", e.target.value || undefined)}
              rows={2}
              className={fieldClass() + " resize-y"}
            />
          </Field>

          {/* Cover image */}
          <Field label="Imagen de portada">
            <ImageUploadField
              value={String(fm.coverImage ?? "")}
              onChange={(v) => updateField("coverImage", v || undefined)}
              target="posts"
              placeholder="/posts/image.jpg"
            />
          </Field>

          {/* Featured image */}
          <Field label="Imagen destacada">
            <ImageUploadField
              value={String(fm.featuredImage ?? "")}
              onChange={(v) => updateField("featuredImage", v || undefined)}
              target="posts"
              placeholder="/posts/image.jpg"
            />
          </Field>

          {/* Image position */}
          <Field label="Posición de imagen" hint="Qué parte de la imagen quieres que se vea dentro del espacio">
            <select
              value={String(fm.imagePosition ?? "")}
              onChange={(e) => updateField("imagePosition", e.target.value || undefined)}
              className={fieldClass()}
            >
              <option value="">— por defecto —</option>
                {IMAGE_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {IMAGE_POSITION_LABELS[p]}
                  </option>
                ))}
            </select>
          </Field>
        </section>

        {/* ---- Presentación ---- */}
        <section className="mb-8 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
            Presentación
          </h3>

          {/* Drop cap mode */}
          <Field label="Capitular" hint="auto = primera letra, ninguna = desactivado, manual = selección manual">
            <select
              value={String((fm.presentacion as Record<string, unknown> | undefined)?.dropCapMode ?? "auto")}
              onChange={(e) => {
                const pres = (fm.presentacion ?? {}) as Record<string, unknown>;
                updateField("presentacion", { ...pres, dropCapMode: e.target.value });
              }}
              className={fieldClass()}
            >
              <option value="auto">automático</option>
              <option value="none">ninguna</option>
              <option value="manual">manual</option>
            </select>
          </Field>

        </section>

        {/* ---- Body ---- */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
            Contenido (Markdown)
          </h3>
          <Suspense
            fallback={
              <div className="h-96 border border-stone-200 rounded-lg flex items-center justify-center text-sm text-stone-400">
                Cargando editor…
              </div>
            }
          >
            <MilkdownEditor value={body} onChange={updateBody} />
          </Suspense>
        </section>
      </div>
      </div>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Eliminar publicación"
          message={`¿Estás seguro de que quieres eliminar "${frontmatter.title ?? slug}"?\n\nEsta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          confirmVariant="danger"
          busy={actionBusy}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showHistory && (
        <HistoryPanel
          slug={slug}
          collection="posts"
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
