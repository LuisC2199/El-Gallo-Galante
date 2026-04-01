// ---------------------------------------------------------------------------
// Admin – top header bar
// ---------------------------------------------------------------------------

export default function Header() {
  const editor =
    typeof window !== "undefined"
      ? (window as any).__EDITOR__
      : null;

  return (
    <header className="h-14 border-b border-stone-200 bg-white flex items-center px-6 shrink-0">
      <h1 className="text-base font-semibold tracking-tight text-stone-800">
        El Gallo Galante
        <span className="ml-2 text-xs font-normal text-stone-400">admin</span>
      </h1>

      <div className="ml-auto flex items-center gap-3">
        {editor && (
          <span className="text-xs text-stone-400" title={editor.email}>
            {editor.name ?? editor.email}
          </span>
        )}
      </div>
    </header>
  );
}
