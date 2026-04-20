// ---------------------------------------------------------------------------
// Admin – list of issues with search and sorting
// ---------------------------------------------------------------------------
import { useEffect, useState, useMemo } from "react";
import type { IssueSummary } from "../../lib/admin/types";
import { formatIssueDate } from "../../lib/format-issue-date";

type SortMode = "newest" | "oldest" | "az" | "za";

interface IssueListProps {
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  refreshKey?: number;
  onNew?: () => void;
}

export default function IssueList({ selectedSlug, onSelect, refreshKey = 0, onNew }: IssueListProps) {
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/admin/issues")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<IssueSummary[]>;
      })
      .then((data) => { if (!cancelled) setIssues(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load issues");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = issues;

    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.slug.toLowerCase().includes(q) ||
          (i.number != null && String(i.number).includes(q)),
      );
    }

    const sorted = [...list];
    switch (sort) {
      case "newest":
        sorted.sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.localeCompare(a.date);
        });
        break;
      case "oldest":
        sorted.sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });
        break;
      case "az":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "es"));
        break;
      case "za":
        sorted.sort((a, b) => b.title.localeCompare(a.title, "es"));
        break;
    }
    return sorted;
  }, [issues, query, sort]);

  if (loading) {
    return (
      <div className="w-72 border-r border-stone-200 shrink-0 p-4 text-sm text-stone-400">
        Loading issues…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-72 border-r border-stone-200 shrink-0 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="w-72 border-r border-stone-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          Números ({filtered.length}/{issues.length})
        </h2>
        {onNew && (
          <button
            onClick={onNew}
            className="text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
          >
            + Nuevo
          </button>
        )}
      </div>

      {/* Search + sort */}
      <div className="px-3 py-2 border-b border-stone-100 space-y-1.5 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar número…"
          className="w-full text-xs rounded border border-stone-200 bg-white px-2.5 py-1.5 text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="w-full text-[11px] rounded border border-stone-200 bg-white px-1.5 py-1 text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-300"
        >
          <option value="newest">Más reciente</option>
          <option value="oldest">Más viejo</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-4 text-xs text-stone-400">
          {issues.length === 0 ? "No issues found." : "No issues match search."}
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-stone-100">
          {filtered.map((i) => (
            <li key={i.slug}>
              <button
                onClick={() => onSelect(i.slug)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selectedSlug === i.slug ? "bg-stone-100" : "hover:bg-stone-50"
                }`}
              >
                <p className="text-sm font-medium text-stone-800 truncate">
                  {i.number ? `${i.number} — ` : ""}{i.title}
                </p>
                {i.date && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {formatIssueDate(
                      new Date(i.date),
                      i.endDate ? new Date(i.endDate) : undefined,
                    )}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
