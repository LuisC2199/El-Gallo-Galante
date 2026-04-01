// ---------------------------------------------------------------------------
// Admin – reusable image upload field with text input + upload button
// ---------------------------------------------------------------------------
import { useState, useRef, useCallback } from "react";
import type { MediaUploadTarget, MediaUploadResponse } from "../../lib/admin/types";

const ACCEPT = ".jpg,.jpeg,.png,.webp";

interface ImageUploadFieldProps {
  /** Current path value (e.g. "/posts/foo.jpg"). */
  value: string;
  /** Called when the path changes, whether via upload or manual edit. */
  onChange: (path: string) => void;
  /** Upload target collection. */
  target: MediaUploadTarget;
  /** Optional placeholder for the text input. */
  placeholder?: string;
}

export default function ImageUploadField({
  value,
  onChange,
  target,
  placeholder = "/path/to/image.jpg",
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("target", target);

        const res = await fetch("/api/admin/media", {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error((body as { error: string }).error);
        }

        const data: MediaUploadResponse = await res.json();
        onChange(data.publicPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir");
      } finally {
        setUploading(false);
        // Reset file input so the same file can be re-selected
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [target, onChange],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  return (
    <div>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setError(null);
          }}
          placeholder={placeholder}
          className="block w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300 transition-colors"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="shrink-0 px-3 py-2 text-sm font-medium rounded-md border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? "Subiendo" : "Subir"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {value && !error && (
        <p className="mt-1 text-xs text-stone-400 truncate">{value}</p>
      )}
    </div>
  );
}
