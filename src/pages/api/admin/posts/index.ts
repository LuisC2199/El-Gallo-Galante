// ---------------------------------------------------------------------------
// GET /api/admin/posts – list all posts with summary data
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, listFiles, getFileContent, decodeContent } from "../../../../lib/admin/github";
import type { CollectionItemSummary } from "../../../../lib/admin/types";
import matter from "gray-matter";

const POSTS_DIR = "src/content/posts";

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const files = await listFiles(cfg, POSTS_DIR);

    // Fetch each file's content to extract frontmatter summary data.
    // For large collections consider paginating or caching; fine for now.
    const summaries: CollectionItemSummary[] = await Promise.all(
      files.map(async (f) => {
        try {
          const raw = await getFileContent(cfg, f.path);
          const decoded = decodeContent(raw.content);
          const { data } = matter(decoded);

          return {
            slug: f.name.replace(/\.md$/, ""),
            filename: f.name,
            path: f.path,
            title: data.title as string | undefined,
            date: data.date ? new Date(data.date as string).toISOString() : undefined,
            category: data.category as string | undefined,
            status: (data.status as string | undefined) ?? "published",
            author: data.author as string | undefined,
            issue: data.issue as string | undefined,
            sha: f.sha,
          } satisfies CollectionItemSummary;
        } catch {
          // If an individual file fails to parse, return minimal info.
          return {
            slug: f.name.replace(/\.md$/, ""),
            filename: f.name,
            path: f.path,
            sha: f.sha,
          } satisfies CollectionItemSummary;
        }
      }),
    );

    // Sort newest first.
    summaries.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    return new Response(JSON.stringify(summaries), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
