// ---------------------------------------------------------------------------
// Admin – Confirmation dialog for destructive actions
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dangerStyle =
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50";
  const defaultStyle =
    "bg-stone-800 text-white hover:bg-stone-700 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-stone-800 mb-2">{title}</h3>
        <p className="text-sm text-stone-600 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded hover:bg-stone-200 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              confirmVariant === "danger" ? dangerStyle : defaultStyle
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
