// ---------------------------------------------------------------------------
// Admin – shared editor UI primitives used by Post, Author, and Issue editors
// ---------------------------------------------------------------------------
import type React from "react";

// ---- Field wrapper ----

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {hint && <span className="ml-2 text-xs text-stone-400">{hint}</span>}
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

// ---- Field input class ----

export function fieldClass(hasError = false): string {
  const base =
    "mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 transition-colors";
  return hasError
    ? `${base} border-red-300 focus:ring-red-300`
    : `${base} border-stone-200 focus:ring-stone-300`;
}

// ---- Date helper ----

export function toDateInput(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  try {
    return new Date(s).toISOString().slice(0, 10);
  } catch {
    return s.slice(0, 10);
  }
}

// ---- Editor top bar ----

interface EditorTopBarProps {
  path: string;
  sha: string;
  dirty: boolean;
  saving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onSave: () => void;
  /** Optional extra buttons rendered before the Save button. */
  extra?: React.ReactNode;
}

export function EditorTopBar({
  path,
  sha,
  dirty,
  saving,
  saveSuccess,
  saveError,
  onSave,
  extra,
}: EditorTopBarProps) {
  return (
    <div className="shrink-0 bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="text-xs font-mono text-stone-400 truncate">{path}</span>
        <span className="text-[10px] font-mono text-stone-300 shrink-0">
          sha: {sha.slice(0, 8)}
        </span>
        {dirty && (
          <span className="text-[10px] font-medium text-amber-600 shrink-0">
            cambios no guardados
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {extra}
        {saveSuccess && (
          <span className="text-xs text-emerald-600 font-medium">Guardado</span>
        )}
        {saveError && (
          <span className="text-xs text-red-600 max-w-xs truncate" title={saveError}>
            {saveError}
          </span>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-1.5 bg-stone-800 text-white text-sm font-medium rounded hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

// ---- Centered status messages ----

export function LoadingMessage({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-sm text-stone-400">
      {text}
    </div>
  );
}

export function ErrorMessage({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-sm text-red-600">
      {text}
    </div>
  );
}
