// ---------------------------------------------------------------------------
// Admin – Preámbulo singleton editor
// Reuses the same MilkdownEditor, EditorTopBar, and save flow as PostEditor,
// but targets the single file src/content/preamble/preamble.md.
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import type { FilePayload, SavePostRequest, SavePostResponse } from "../../lib/admin/types";
import {
  Field,
  fieldClass,
  EditorTopBar,
  LoadingMessage,
  ErrorMessage,
} from "./EditorFields";

const MilkdownEditor = lazy(() => import("./MilkdownEditor"));

interface PreambleEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
}

export default function PreambleEditor({ onDirtyChange }: PreambleEditorProps) {
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

  // Dirty tracking
  const [dirty, setDirtyInternal] = useState(false);

  const setDirty = useCallback(
    (value: boolean) => {
      setDirtyInternal(value);
      onDirtyChange?.(value);
    },
    [onDirtyChange],
  );

  // ---- Load preamble ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setSaveSuccess(false);
    setDirty(false);

    async function load() {
      try {
        const res = await fetch("/api/admin/preamble");
        if (!res.ok) {
          const errBody = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(errBody?.error ?? `HTTP ${res.status}`);
        }
        const data: FilePayload = await res.json();
        if (!cancelled) {
          setFrontmatter(data.frontmatter);
          setBody(data.body);
          setPath(data.path);
          setSha(data.sha);
        }
      } catch (err) {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "Error al cargar el preámbulo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Field updaters ----
  const updateField = useCallback((key: string, value: unknown) => {
    setFrontmatter((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const updateBody = useCallback(
    (value: string) => {
      setBody(value);
      setDirty(true);
      setSaveSuccess(false);
      setSaveError(null);
    },
    [],
  );

  // ---- Save ----
  const handleSave = useCallback(async () => {
    if (!frontmatter.title || String(frontmatter.title).trim() === "") {
      setSaveError("El título es obligatorio");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const payload: SavePostRequest = { path, sha, frontmatter, body };

      const res = await fetch("/api/admin/preamble", {
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
  }, [frontmatter, body, path, sha]);

  // ---- Render ----
  const fm = frontmatter;

  if (loading) return <LoadingMessage />;
  if (loadError) return <ErrorMessage text={loadError} />;

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
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          {/* ---- Frontmatter fields ---- */}
          <section className="mb-8 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Preámbulo
            </h3>

            <Field label="Título">
              <input
                type="text"
                value={String(fm.title ?? "")}
                onChange={(e) => updateField("title", e.target.value)}
                className={fieldClass()}
              />
            </Field>
          </section>

          {/* ---- Body editor ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
              Contenido
            </h3>

            <Suspense
              fallback={
                <div className="h-64 flex items-center justify-center text-sm text-stone-400">
                  Cargando editor…
                </div>
              }
            >
              <MilkdownEditor
                key={sha}
                value={body}
                onChange={updateBody}
              />
            </Suspense>
          </section>
        </div>
      </div>
    </div>
  );
}
