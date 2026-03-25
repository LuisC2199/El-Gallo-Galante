// ---------------------------------------------------------------------------
// Admin – left sidebar with collection navigation
// ---------------------------------------------------------------------------

interface SidebarProps {
  activeCollection: string;
  onCollectionChange: (collection: string) => void;
}

const collections = [
  { id: "posts", label: "Posts" },
  { id: "authors", label: "Authors" },
  { id: "issues", label: "Issues" },
] as const;

export default function Sidebar({ activeCollection, onCollectionChange }: SidebarProps) {
  return (
    <aside className="w-56 border-r border-stone-200 bg-stone-50 flex flex-col shrink-0">
      <div className="px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
          Collections
        </p>
        <nav className="flex flex-col gap-0.5">
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => onCollectionChange(c.id)}
              className={`text-left px-3 py-1.5 rounded text-sm transition-colors ${
                activeCollection === c.id
                  ? "bg-stone-200 text-stone-900 font-medium"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-800"
              }`}
            >
              {c.label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
