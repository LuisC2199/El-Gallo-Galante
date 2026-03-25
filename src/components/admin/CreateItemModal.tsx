// ---------------------------------------------------------------------------
// Admin – reusable modal for creating a new collection item
// ---------------------------------------------------------------------------
import { useState, useCallback } from "react";
import type { CreateItemResponse, AuthorSummary, IssueSummary, PostCategory } from "../../lib/admin/types";

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

interface TextField {
  kind: "text";
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}

interface DateField {
  kind: "date";
  key: string;
  label: string;
  required?: boolean;
}

interface SelectField {
  kind: "select";
  key: string;
  label: string;
  required?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

type FieldDef = TextField | DateField | SelectField;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateItemModalProps {
  /** Modal title, e.g. "New Post". */
  title: string;
  /** Field definitions for the form. */
  fields: FieldDef[];
  /** API endpoint to POST to (e.g. "/api/admin/posts/create"). */
  endpoint: string;
  /** Called after successful creation with the new slug. */
  onCreate: (slug: string) => void;
  /** Called to close the modal without creating. */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateItemModal({
  title,
  fields,
  endpoint,
  onCreate,
  onCancel,
}: CreateItemModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = f.kind === "date" ? new Date().toISOString().slice(0, 10) : "";
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Client-side required check
      for (const f of fields) {
        if (f.required && !values[f.key]?.trim()) {
          setError(`${f.label} is required`);
          return;
        }
      }

      setSubmitting(true);
      setError(null);

      try {
        // Build payload — send date in ISO format
        const payload: Record<string, string | undefined> = {};
        for (const f of fields) {
          const v = values[f.key]?.trim();
          if (v) {
            payload[f.key] = f.kind === "date" ? `${v}T00:00:00.000Z` : v;
          }
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error((body as { error: string }).error);
        }

        const data: CreateItemResponse = await res.json();
        onCreate(data.slug);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Creation failed");
      } finally {
        setSubmitting(false);
      }
    },
    [fields, values, endpoint, onCreate],
  );

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-stone-700">
                {f.label}
                {f.required && <span className="text-red-500 ml-0.5">*</span>}
              </span>
              {f.kind === "select" ? (
                <select
                  value={values[f.key]}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                  className="mt-1 block w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                >
                  <option value="">{f.placeholder ?? "— select —"}</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.kind === "date" ? "date" : "text"}
                  value={values[f.key]}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                  placeholder={f.kind === "text" ? f.placeholder : undefined}
                  className="mt-1 block w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              )}
            </label>
          ))}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-stone-600 rounded-md hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-stone-800 rounded-md hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pre-built field configs for each collection
// ---------------------------------------------------------------------------

export function postFields(
  authors: AuthorSummary[],
  issues: IssueSummary[],
): FieldDef[] {
  const categories: PostCategory[] = ["Poesía", "Narrativa", "Crítica", "Ensayo", "Epistolario"];

  return [
    { kind: "text", key: "title", label: "Title", required: true, placeholder: "Post title" },
    { kind: "date", key: "date", label: "Date", required: true },
    {
      kind: "select", key: "category", label: "Category", required: true,
      options: categories.map((c) => ({ value: c, label: c })),
    },
    {
      kind: "select", key: "author", label: "Author", required: true,
      options: authors.map((a) => ({ value: a.slug, label: a.name })),
    },
    {
      kind: "select", key: "issue", label: "Issue",
      options: issues.map((i) => ({
        value: i.slug,
        label: i.number ? `${i.number} — ${i.title}` : i.title,
      })),
    },
    {
      kind: "select", key: "traductor", label: "Traductor",
      placeholder: "— none —",
      options: authors.map((a) => ({ value: a.slug, label: a.name })),
    },
  ];
}

export function authorFields(): FieldDef[] {
  return [
    { kind: "text", key: "name", label: "Name", required: true, placeholder: "Full name" },
    { kind: "text", key: "birthYear", label: "Birth Year", placeholder: "e.g. 1990" },
    { kind: "text", key: "birthPlace", label: "Birth Place", placeholder: "e.g. Guanajuato" },
  ];
}

export function issueFields(): FieldDef[] {
  return [
    { kind: "text", key: "title", label: "Title", required: true, placeholder: "e.g. Año 2 número 3" },
    { kind: "date", key: "date", label: "Date" },
    { kind: "text", key: "number", label: "Number", placeholder: "e.g. No. 03" },
    { kind: "text", key: "description", label: "Description", placeholder: "Short description" },
  ];
}
