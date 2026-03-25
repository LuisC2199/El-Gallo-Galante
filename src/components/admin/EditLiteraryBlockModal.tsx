// ---------------------------------------------------------------------------
// Admin – Editing modal for literary blocks
// ---------------------------------------------------------------------------
//
// Displays a small modal with format-specific fields.  Used for both
// inserting new literary blocks and editing existing ones.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import type { LiteraryFormat } from "./literary-formats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditModalState {
  format: LiteraryFormat;
  values: Record<string, string>;
  mode: "insert" | "edit";
  /** Document position of the node — only set in edit mode. */
  nodePos?: number;
}

interface Props {
  state: EditModalState;
  onSave: (html: string, mode: "insert" | "edit", nodePos?: number) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditLiteraryBlockModal({
  state,
  onSave,
  onClose,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(state.values);
  const firstRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Auto-focus first field
  useEffect(() => {
    requestAnimationFrame(() => firstRef.current?.focus());
  }, []);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const html = state.format.template(values);
    onSave(html, state.mode, state.nodePos);
  };

  const inputClass =
    "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-lg shadow-xl border border-stone-200 p-5 animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
            <span className="text-stone-400">{state.format.icon}</span>
            {state.mode === "insert" ? "Insertar" : "Editar"}{" "}
            {state.format.label}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {state.format.fields.map((field, i) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-stone-500 mb-1">
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  ref={i === 0 ? (firstRef as React.Ref<HTMLTextAreaElement>) : undefined}
                  value={values[field.key] ?? ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  rows={4}
                  className={inputClass}
                />
              ) : (
                <input
                  ref={i === 0 ? (firstRef as React.Ref<HTMLInputElement>) : undefined}
                  type="text"
                  value={values[field.key] ?? ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={inputClass}
                />
              )}
            </div>
          ))}
        </div>

        {/* Preview hint */}
        <p className="text-[11px] text-stone-400 mt-3">
          {state.format.description}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-stone-800 text-white hover:bg-stone-700 transition-colors"
          >
            {state.mode === "insert" ? "Insertar" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
