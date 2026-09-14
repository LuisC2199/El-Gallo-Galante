// ---------------------------------------------------------------------------
// Admin – list of posts with search, filtering, and sorting
// ---------------------------------------------------------------------------
import { useEffect, useState, useMemo, useCallback } from "react";
import type {
  CollectionItemSummary,
  AuthorSummary,
  IssueSummary,
  FilePayload,
} from "../../lib/admin/types";

type SortMode = "newest" | "oldest" | "az" | "za";

const CATEGORIES = ["Poesía", "Narrativa", "Crítica", "Ensayo", "Epistolario"];
const DETAIL_FETCH_CONCURRENCY = 4;

const STATUS_OPTIONS = [
  { value: "published", label: "Publicado", dotColor: "bg-emerald-400" },
  { value: "review", label: "En revisión", dotColor: "bg-blue-400" },
  { value: "draft", label: "Borrador", dotColor: "bg-amber-400" },
];

const STATUS_DOT: Record<string, string> = {
  draft: "bg-amber-400",
  review: "bg-blue-400",
  published: "bg-emerald-400",
};

function isIncompleteSummary(post: CollectionItemSummary): boolean {
  return !post.title || !post.date || !post.category || !post.author || !post.issue;
}

function dateFromFrontmatter(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function mergePostPayload(
  summary: CollectionItemSummary,
  payload: FilePayload,
): CollectionItemSummary {
  const fm = payload.frontmatter;

  return {
    ...summary,
    path: payload.path || summary.path,
    sha: payload.sha || summary.sha,
    title: typeof fm.title === "string" ? fm.title : summary.title,
    date: dateFromFrontmatter(fm.date) ?? summary.date,
    category: typeof fm.category === "string" ? fm.category : summary.category,
    status: typeof fm.status === "string" ? fm.status : (summary.status ?? "published"),
    author: typeof fm.author === "string" ? fm.author : summary.author,
    issue: typeof fm.issue === "string" ? fm.issue : summary.issue,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

async function repairPostSummary(
  post: CollectionItemSummary,
): Promise<CollectionItemSummary | null> {
  try {
    const res = await fetch(
      `/api/admin/posts/${encodeURIComponent(post.slug)}?refresh=${Date.now()}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as FilePayload;
    return mergePostPayload(post, payload);
  } catch (err) {
    console.warn(
      "[PostList] failed to repair post summary:",
      post.slug,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

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
  const [statusFilter, setStatusFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [issueFilter, setIssueFilter] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadPosts() {
      try {
        const res = await fetch(`/api/admin/posts?refresh=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as CollectionItemSummary[];
        if (cancelled) return;
        setPosts(data);
        setLoading(false);

        const incomplete = data.filter(isIncompleteSummary);
        if (incomplete.length === 0) return;

        const repaired = await mapWithConcurrency(
          incomplete,
          DETAIL_FETCH_CONCURRENCY,
          repairPostSummary,
        );
        if (cancelled) return;

        const repairedBySlug = new Map(
          repaired
            .filter((post): post is CollectionItemSummary => post !== null)
            .map((post) => [post.slug, post]),
        );

        if (repairedBySlug.size > 0) {
          setPosts((current) =>
            current.map((post) => repairedBySlug.get(post.slug) ?? post),
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPosts();

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
    if (statusFilter) list = list.filter((p) => (p.status ?? "published") === statusFilter);
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
  }, [posts, query, categoryFilter, statusFilter, authorFilter, issueFilter, sort]);

  const hasActiveFilters = categoryFilter || statusFilter || authorFilter || issueFilter;

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategoryFilter("");
    setStatusFilter("");
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
        Cargando publicaciones…
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
          Publicaciones ({filtered.length}/{posts.length})
        </h2>
        {onNew && (
          <button
            onClick={onNew}
            className="text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
          >
            + Crear
          </button>
        )}
      </div>

      {/* Search + sort */}
      <div className="px-3 py-2 border-b border-stone-100 space-y-1.5 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar publicaciones…"
          className="w-full text-xs rounded border border-stone-200 bg-white px-2.5 py-1.5 text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300"
        />
        <div className="flex gap-1.5">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className={selectClass}>
            <option value="newest">Más reciente</option>
            <option value="oldest">Más viejo</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="">Estado</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {usedAuthors.length > 0 && (
            <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} className={selectClass}>
              <option value="">Autor</option>
              {usedAuthors.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
          )}
          {usedIssues.length > 0 && (
            <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)} className={selectClass}>
              <option value="">Número</option>
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
            Borrar filtros
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-4 text-xs text-stone-400">
          {posts.length === 0 ? "Ninguna publicación encontrada." : "Ninguna publicación coincide con los filtros."}
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
                  {p.status && p.status !== "published" && (
                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status] ?? ""}`} title={p.status} />
                  )}
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
