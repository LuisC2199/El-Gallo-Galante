// ---------------------------------------------------------------------------
// Admin – Inline image insertion for the Milkdown editor
// ---------------------------------------------------------------------------
//
// Renders an "Imagen" button in the editor toolbar.  When clicked it opens
// a dialog where the editor can upload an image (via the existing GitHub
// media endpoint), set alt text, optional caption and alignment, then
// insert a semantic <figure> block at the current cursor position.
//
// Must be rendered inside <MilkdownProvider>.
// ---------------------------------------------------------------------------

import { useState, useRef, useCallback } from "react";
import { useInstance } from "@milkdown/react";
import { insert } from "@milkdown/kit/utils";
import type { MediaUploadResponse } from "../../lib/admin/types";

const ACCEPT = ".jpg,.jpeg,.png,.webp";
type Alignment = "left" | "center" | "right";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFigureHtml(
  src: string,
  alt: string,
  caption: string,
  align: Alignment,
): string {
  const safeSrc = escapeHtml(src);
  const altAttr = alt ? ` alt="${escapeHtml(alt)}"` : "";
  const captionLine = caption
    ? `\n  <figcaption class="caption">${escapeHtml(caption)}</figcaption>`
    : "";
  return `<figure class="image-block align-${align}">\n  <img src="${safeSrc}"${altAttr} />${captionLine}\n</figure>`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImageInsertButton() {
  const [loading, getEditor] = useInstance();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [align, setAlign] = useState<Alignment>("center");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setSrc("");
    setAlt("");
    setCaption("");
    setAlign("center");
    setError(null);
    setUploading(false);
  }, []);

  const openDialog = useCallback(() => {
    reset();
    setDialogOpen(true);
  }, [reset]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    reset();
  }, [reset]);

  // ---- Upload via existing /api/admin/media endpoint ----

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("target", "posts");

      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((body as { error: string }).error);
      }

      const data: MediaUploadResponse = await res.json();
      setSrc(data.publicPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  // ---- Insert the figure block into the editor ----

  const handleInsert = useCallback(() => {
    if (!src) return;
    const editor = getEditor();
    if (!editor) return;

    const html = buildFigureHtml(src, alt, caption, align);
    editor.action(insert(`\n\n${html}\n\n`));
    closeDialog();
  }, [src, alt, caption, align, getEditor, closeDialog]);

  // ---- Render ----

  const inputClass =
    "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300";

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={loading}
        title="Insertar imagen en el cuerpo"
        className="px-2 py-1 rounded text-stone-600 hover:bg-stone-200 hover:text-stone-800 disabled:opacity-40 transition-colors whitespace-nowrap"
      >
        Imagen
      </button>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Dialog overlay */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-stone-200 p-6">
            <h3 className="text-sm font-semibold text-stone-800 mb-4">
              Insertar imagen
            </h3>

            {/* Upload area */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-stone-500 mb-1">
                Imagen
              </label>
              {src ? (
                <div className="space-y-2">
                  <img
                    src={src}
                    alt="Preview"
                    className="max-h-48 rounded border border-stone-200 object-contain w-full bg-stone-50"
                  />
                  <p className="text-xs text-stone-400 truncate">{src}</p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs text-stone-500 hover:text-stone-700 underline"
                  >
                    Reemplazar imagen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-stone-300 rounded-lg py-8 text-sm text-stone-400 hover:border-stone-400 hover:text-stone-500 transition-colors disabled:opacity-50"
                >
                  {uploading ? "Subiendo…" : "Seleccionar imagen"}
                </button>
              )}
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            </div>

            {/* Alt text */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-stone-500 mb-1">
                Texto alternativo
              </label>
              <input
                type="text"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Descripción de la imagen…"
                className={inputClass}
              />
            </div>

            {/* Caption */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-stone-500 mb-1">
                Pie de imagen{" "}
                <span className="text-stone-300">(opcional)</span>
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Texto debajo de la imagen…"
                className={inputClass}
              />
            </div>

            {/* Alignment */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-stone-500 mb-1">
                Alineación
              </label>
              <div className="flex gap-2">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAlign(a)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                      align === a
                        ? "border-stone-400 bg-stone-100 text-stone-800 font-medium"
                        : "border-stone-200 text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    {a === "left"
                      ? "Izquierda"
                      : a === "center"
                        ? "Centro"
                        : "Derecha"}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={closeDialog}
                className="px-4 py-2 text-sm rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleInsert}
                disabled={!src}
                className="px-4 py-2 text-sm rounded-md bg-stone-800 text-white hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
