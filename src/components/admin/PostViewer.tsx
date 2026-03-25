// ---------------------------------------------------------------------------
// Admin – viewer for a single post (frontmatter + body)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import type { FilePayload } from "../../lib/admin/types";

interface PostViewerProps {
  slug: string;
}

export default function PostViewer({ slug }: PostViewerProps) {
  const [payload, setPayload] = useState<FilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPayload(null);

    async function load() {
      try {
        const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FilePayload = await res.json();
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load post");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-stone-400">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Path + SHA */}
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-xs font-mono text-stone-400">{payload.path}</span>
        <span className="text-[10px] font-mono text-stone-300">sha: {payload.sha.slice(0, 8)}</span>
      </div>

      {/* Frontmatter panel */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
          Frontmatter
        </h3>
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 overflow-x-auto">
          <table className="text-sm w-full">
            <tbody>
              {Object.entries(payload.frontmatter).map(([key, value]) => (
                <tr key={key} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5 pr-4 font-medium text-stone-600 align-top whitespace-nowrap">
                    {key}
                  </td>
                  <td className="py-1.5 text-stone-800 break-all">
                    {typeof value === "object" ? (
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : (
                      String(value)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Body textarea */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
          Markdown body
        </h3>
        <textarea
          readOnly
          value={payload.body}
          className="w-full h-96 bg-white border border-stone-200 rounded-lg p-4 text-sm font-mono text-stone-700 resize-y focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </section>
    </div>
  );
}
