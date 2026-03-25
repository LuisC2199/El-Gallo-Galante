// ---------------------------------------------------------------------------
// Admin – list of posts with search, filtering, and sorting
// ---------------------------------------------------------------------------
import { useEffect, useState, useMemo, useCallback } from "react";
import type { CollectionItemSummary, AuthorSummary, IssueSummary } from "../../lib/admin/types";

type SortMode = "newest" | "oldest" | "az" | "za";

const CATEGORIES = ["Poesía", "Narrativa", "Crítica", "Ensayo", "Epistolario"];

interface PostListProps {
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  refreshKey?: number;
  onNew?: () => void;
  /** Author summaries for filter dropdown. */
  authors?: AuthorSummary[];
  /** Issue summaries for filter dropdown. */
  issues?: IssueSummary[];
}

export default function PostList({
  selectedSlug,
  onSelect,
  refreshKey = 0,
  onNew,
  authors = [],
  issues = [],
}: PostListProps) {
  const [posts, setPosts] = useState<CollectionItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & filter state
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [issueFilter, setIssueFilter] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/admin/posts")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CollectionItemSummary[]>;
      })
      .then((data) => { if (!cancelled) setPosts(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load posts");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [refreshKey]);

  // Derive filtered + sorted list
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = posts;

    if (q) {
      list = list.filter(
        (p) =>
          (p.title ?? "").toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q),
      );
    }
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter);
    if (authorFilter) list = list.filter((p) => p.author === authorFilter);
    if (issueFilter) list = list.filter((p) => p.issue === issueFilter);

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
        sorted.sort((a, b) => (a.title ?? a.slug).localeCompare(b.title ?? b.slug, "es"));
        break;
      case "za":
        sorted.sort((a, b) => (b.title ?? b.slug).localeCompare(a.title ?? a.slug, "es"));
        break;
    }
    return sorted;
  }, [posts, query, categoryFilter, authorFilter, issueFilter, sort]);

  const hasActiveFilters = categoryFilter || authorFilter || issueFilter;

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategoryFilter("");
    setAuthorFilter("");
    setIssueFilter("");
  }, []);

  // Compute unique authors/issues actually used in posts for filter options
  const usedAuthors = useMemo(() => {
    const slugs = new Set(posts.map((p) => p.author).filter(Boolean));
    return authors.filter((a) => slugs.has(a.slug));
  }, [posts, authors]);

  const usedIssues = useMemo(() => {
    const slugs = new Set(posts.map((p) => p.issue).filter(Boolean));
    return issues.filter((i) => slugs.has(i.slug));
  }, [posts, issues]);

  if (loading) {
    return (
      <div className="w-72 border-r border-stone-200 shrink-0 p-4 text-sm text-stone-400">
        Loading posts…
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

  const selectClass =
    "w-full text-[11px] rounded border border-stone-200 bg-white px-1.5 py-1 text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-300";

  return (
    <div className="w-72 border-r border-stone-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          Posts ({filtered.length}/{posts.length})
        </h2>
        {onNew && (
          <button
            onClick={onNew}
            className="text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
          >
            + New
          </button>
        )}
      </div>

      {/* Search + sort */}
      <div className="px-3 py-2 border-b border-stone-100 space-y-1.5 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts…"
          className="w-full text-xs rounded border border-stone-200 bg-white px-2.5 py-1.5 text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
        />
        <div className="flex gap-1.5">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className={selectClass}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          {usedAuthors.length > 0 && (
            <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} className={selectClass}>
              <option value="">All authors</option>
              {usedAuthors.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
          )}
          {usedIssues.length > 0 && (
            <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)} className={selectClass}>
              <option value="">All issues</option>
              {usedIssues.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.number ? `#${i.number}` : i.title}
                </option>
              ))}
            </select>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-4 text-xs text-stone-400">
          {posts.length === 0 ? "No posts found." : "No posts match filters."}
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-stone-100">
          {filtered.map((p) => (
            <li key={p.slug}>
              <button
                onClick={() => onSelect(p.slug)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selectedSlug === p.slug ? "bg-stone-100" : "hover:bg-stone-50"
                }`}
              >
                <p className="text-sm font-medium text-stone-800 truncate">
                  {p.title ?? p.slug}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.date && (
                    <span className="text-xs text-stone-400">
                      {new Date(p.date).toLocaleDateString("es-MX", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  {p.category && (
                    <span className="text-[10px] text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded">
                      {p.category}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
