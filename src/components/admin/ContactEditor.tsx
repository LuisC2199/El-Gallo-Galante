// ---------------------------------------------------------------------------
// Admin - Contact page singleton editor
// Edits the publication bases and conditions rendered on /contacto.
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback } from "react";
import type { FilePayload, SaveFileRequest, SaveFileResponse } from "../../lib/admin/types";
import {
  Field,
  fieldClass,
  EditorTopBar,
  LoadingMessage,
  ErrorMessage,
} from "./EditorFields";

interface ContactEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
}

interface BaseItem {
  title?: string;
  text: string;
}

interface Notice {
  title?: string;
  text?: string;
}

interface ValidationErrors {
  title?: string;
  heading?: string;
  intro?: string;
  conditionsHeading?: string;
  bases?: string;
  conditions?: string;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeBaseItems(value: unknown): BaseItem[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    if (typeof item === "string") return { text: item };
    if (!item || typeof item !== "object") return { text: "" };

    const record = item as Record<string, unknown>;
    return {
      title: normalizeText(record.title),
      text: normalizeText(record.text),
    };
  });
}

function normalizeConditions(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => normalizeText(item)) : [];
}

function normalizeNotice(value: unknown): Notice {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const record = value as Record<string, unknown>;
  return {
    title: normalizeText(record.title),
    text: normalizeText(record.text),
  };
}

function cleanInline(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

function cleanFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
  const bases = normalizeBaseItems(fm.bases)
    .map((item) => {
      const title = cleanInline(item.title);
      const text = cleanInline(item.text);
      return {
        ...(title ? { title } : {}),
        text,
      };
    })
    .filter((item) => item.text.length > 0);

  const conditions = normalizeConditions(fm.conditions)
    .map(cleanInline)
    .filter((item) => item.length > 0);

  const description = cleanInline(fm.description);
  const note = cleanInline(fm.note);
  const notice = normalizeNotice(fm.notice);
  const noticeTitle = cleanInline(notice.title);
  const noticeText = cleanInline(notice.text);

  return {
    ...fm,
    title: cleanInline(fm.title),
    description: description || undefined,
    heading: cleanInline(fm.heading),
    intro: cleanInline(fm.intro),
    bases,
    conditionsHeading: cleanInline(fm.conditionsHeading),
    conditions,
    note: note || undefined,
    notice:
      noticeTitle || noticeText
        ? {
            title: noticeTitle || undefined,
            text: noticeText || undefined,
          }
        : undefined,
  };
}

function validate(fm: Record<string, unknown>): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!cleanInline(fm.title)) errors.title = "El título de página es obligatorio";
  if (!cleanInline(fm.heading)) errors.heading = "El encabezado es obligatorio";
  if (!cleanInline(fm.intro)) errors.intro = "La introducción es obligatoria";
  if (!cleanInline(fm.conditionsHeading)) {
    errors.conditionsHeading = "El encabezado de condiciones es obligatorio";
  }
  if (normalizeBaseItems(fm.bases).filter((item) => cleanInline(item.text)).length === 0) {
    errors.bases = "Agrega al menos una base de publicación";
  }
  if (normalizeConditions(fm.conditions).filter((item) => cleanInline(item)).length === 0) {
    errors.conditions = "Agrega al menos una condición de publicación";
  }

  return errors;
}

function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

function swap<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;

  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function ContactEditor({ onDirtyChange }: ContactEditorProps) {
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

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveSuccess(false);
    setSaveError(null);
  }, [setDirty]);

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
        const res = await fetch("/api/admin/contact");
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
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Error al cargar contacto");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [setDirty]);

  const updateField = useCallback(
    (key: string, value: unknown) => {
      setFrontmatter((prev) => ({ ...prev, [key]: value }));
      markDirty();
      if (showValidation) {
        setValidationErrors((prev) => {
          const next = { ...prev };
          delete (next as Record<string, string | undefined>)[key];
          return next;
        });
      }
    },
    [markDirty, showValidation],
  );

  const updateBase = useCallback(
    (index: number, patch: Partial<BaseItem>) => {
      setFrontmatter((prev) => {
        const current = normalizeBaseItems(prev.bases);
        const items = current.length > 0 ? current : [{ text: "" }];
        const next = items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item,
        );
        return { ...prev, bases: next };
      });
      markDirty();
      if (showValidation) setValidationErrors((prev) => ({ ...prev, bases: undefined }));
    },
    [markDirty, showValidation],
  );

  const addBase = useCallback(() => {
    setFrontmatter((prev) => ({
      ...prev,
      bases: [...normalizeBaseItems(prev.bases), { text: "" }],
    }));
    markDirty();
  }, [markDirty]);

  const removeBase = useCallback(
    (index: number) => {
      setFrontmatter((prev) => {
        const current = normalizeBaseItems(prev.bases);
        if (current.length <= 1) return prev;
        return { ...prev, bases: current.filter((_, itemIndex) => itemIndex !== index) };
      });
      markDirty();
    },
    [markDirty],
  );

  const moveBase = useCallback(
    (index: number, direction: -1 | 1) => {
      setFrontmatter((prev) => ({
        ...prev,
        bases: swap(normalizeBaseItems(prev.bases), index, direction),
      }));
      markDirty();
    },
    [markDirty],
  );

  const updateCondition = useCallback(
    (index: number, value: string) => {
      setFrontmatter((prev) => {
        const current = normalizeConditions(prev.conditions);
        const items = current.length > 0 ? current : [""];
        const next = items.map((item, itemIndex) => (itemIndex === index ? value : item));
        return { ...prev, conditions: next };
      });
      markDirty();
      if (showValidation) setValidationErrors((prev) => ({ ...prev, conditions: undefined }));
    },
    [markDirty, showValidation],
  );

  const addCondition = useCallback(() => {
    setFrontmatter((prev) => ({
      ...prev,
      conditions: [...normalizeConditions(prev.conditions), ""],
    }));
    markDirty();
  }, [markDirty]);

  const removeCondition = useCallback(
    (index: number) => {
      setFrontmatter((prev) => {
        const current = normalizeConditions(prev.conditions);
        if (current.length <= 1) return prev;
        return {
          ...prev,
          conditions: current.filter((_, itemIndex) => itemIndex !== index),
        };
      });
      markDirty();
    },
    [markDirty],
  );

  const moveCondition = useCallback(
    (index: number, direction: -1 | 1) => {
      setFrontmatter((prev) => ({
        ...prev,
        conditions: swap(normalizeConditions(prev.conditions), index, direction),
      }));
      markDirty();
    },
    [markDirty],
  );

  const updateNotice = useCallback(
    (key: keyof Notice, value: string) => {
      setFrontmatter((prev) => {
        const notice = normalizeNotice(prev.notice);
        return {
          ...prev,
          notice: {
            ...notice,
            [key]: value || undefined,
          },
        };
      });
      markDirty();
    },
    [markDirty],
  );

  const handleSave = useCallback(async () => {
    const cleaned = cleanFrontmatter(frontmatter);
    const errors = validate(cleaned);
    setValidationErrors(errors);
    setShowValidation(true);

    if (hasErrors(errors)) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const payload: SaveFileRequest = { path, sha, frontmatter: cleaned, body };

      const res = await fetch("/api/admin/contact", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error: string }).error);
      }

      const result: SaveFileResponse = await res.json();
      setFrontmatter(cleaned);
      setSha(result.sha);
      setDirty(false);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [frontmatter, body, path, sha, setDirty]);

  if (loading) return <LoadingMessage />;
  if (loadError) return <ErrorMessage text={loadError} />;

  const fm = frontmatter;
  const bases = normalizeBaseItems(fm.bases);
  const visibleBases = bases.length > 0 ? bases : [{ text: "" }];
  const conditions = normalizeConditions(fm.conditions);
  const visibleConditions = conditions.length > 0 ? conditions : [""];
  const notice = normalizeNotice(fm.notice);

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
          <section className="mb-8 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Página Contacto
            </h3>

            <Field label="Título de página" error={showValidation ? validationErrors.title : undefined}>
              <input
                type="text"
                value={String(fm.title ?? "")}
                onChange={(e) => updateField("title", e.target.value)}
                className={fieldClass(showValidation && !!validationErrors.title)}
              />
            </Field>

            <Field label="Descripción SEO">
              <textarea
                value={String(fm.description ?? "")}
                onChange={(e) => updateField("description", e.target.value || undefined)}
                rows={2}
                className={fieldClass() + " resize-y"}
              />
            </Field>
          </section>

          <section className="mb-8 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Bases de publicación
            </h3>

            <Field label="Encabezado" error={showValidation ? validationErrors.heading : undefined}>
              <input
                type="text"
                value={String(fm.heading ?? "")}
                onChange={(e) => updateField("heading", e.target.value)}
                className={fieldClass(showValidation && !!validationErrors.heading)}
              />
            </Field>

            <Field label="Introducción" error={showValidation ? validationErrors.intro : undefined}>
              <textarea
                value={String(fm.intro ?? "")}
                onChange={(e) => updateField("intro", e.target.value)}
                rows={2}
                className={fieldClass(showValidation && !!validationErrors.intro) + " resize-y"}
              />
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-700">Lista de bases</p>
                  <p className="text-xs text-stone-400">Puedes usar Markdown sencillo: *cursiva*, **negritas**, enlaces y `código`.</p>
                </div>
                <button
                  type="button"
                  onClick={addBase}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 transition-colors"
                >
                  Añadir base
                </button>
              </div>
              {showValidation && validationErrors.bases && (
                <p className="mb-2 text-xs text-red-600">{validationErrors.bases}</p>
              )}

              <div className="space-y-3">
                {visibleBases.map((item, index) => (
                  <div
                    key={`base-${index}`}
                    className="rounded-md border border-stone-200 bg-stone-50/70 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold text-stone-400">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveBase(index, -1)}
                          disabled={index === 0}
                          className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-30"
                        >
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBase(index, 1)}
                          disabled={index === visibleBases.length - 1}
                          className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-30"
                        >
                          Bajar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBase(index)}
                          disabled={visibleBases.length <= 1}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Field label="Subtítulo opcional">
                        <input
                          type="text"
                          value={item.title ?? ""}
                          onChange={(e) => updateBase(index, { title: e.target.value })}
                          className={fieldClass()}
                          placeholder="Ej. Extensión"
                        />
                      </Field>
                      <Field label="Texto">
                        <textarea
                          value={item.text}
                          onChange={(e) => updateBase(index, { text: e.target.value })}
                          rows={4}
                          className={fieldClass() + " resize-y leading-relaxed"}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mb-8 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Condiciones de publicación
            </h3>

            <Field
              label="Encabezado"
              error={showValidation ? validationErrors.conditionsHeading : undefined}
            >
              <input
                type="text"
                value={String(fm.conditionsHeading ?? "")}
                onChange={(e) => updateField("conditionsHeading", e.target.value)}
                className={fieldClass(showValidation && !!validationErrors.conditionsHeading)}
              />
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-700">Lista de condiciones</p>
                  <p className="text-xs text-stone-400">Cada renglón se publicará como una viñeta.</p>
                </div>
                <button
                  type="button"
                  onClick={addCondition}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 transition-colors"
                >
                  Añadir condición
                </button>
              </div>
              {showValidation && validationErrors.conditions && (
                <p className="mb-2 text-xs text-red-600">{validationErrors.conditions}</p>
              )}

              <div className="space-y-3">
                {visibleConditions.map((condition, index) => (
                  <div
                    key={`condition-${index}`}
                    className="rounded-md border border-stone-200 bg-stone-50/70 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold text-stone-400">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveCondition(index, -1)}
                          disabled={index === 0}
                          className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-30"
                        >
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCondition(index, 1)}
                          disabled={index === visibleConditions.length - 1}
                          className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-30"
                        >
                          Bajar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCondition(index)}
                          disabled={visibleConditions.length <= 1}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    <Field label="Texto">
                      <textarea
                        value={condition}
                        onChange={(e) => updateCondition(index, e.target.value)}
                        rows={4}
                        className={fieldClass() + " resize-y leading-relaxed"}
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Nota final">
              <textarea
                value={String(fm.note ?? "")}
                onChange={(e) => updateField("note", e.target.value || undefined)}
                rows={3}
                className={fieldClass() + " resize-y leading-relaxed"}
              />
            </Field>

            <div className="rounded-md border border-stone-200 bg-stone-50/70 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">
                Aviso inferior
              </h4>
              <div className="space-y-3">
                <Field label="Título">
                  <input
                    type="text"
                    value={notice.title ?? ""}
                    onChange={(e) => updateNotice("title", e.target.value)}
                    className={fieldClass()}
                    placeholder="Convocatoria número 1"
                  />
                </Field>
                <Field label="Texto">
                  <textarea
                    value={notice.text ?? ""}
                    onChange={(e) => updateNotice("text", e.target.value)}
                    rows={3}
                    className={fieldClass() + " resize-y leading-relaxed"}
                    placeholder="Estará abierta desde..."
                  />
                </Field>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
