// ---------------------------------------------------------------------------
// GET /api/admin/issues – list all issues with summary data
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, listFiles, getFileContent, decodeContent } from "../../../../lib/admin/github";
import type { IssueSummary } from "../../../../lib/admin/types";
import matter from "gray-matter";

const ISSUES_DIR = "src/content/issues";

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const files = await listFiles(cfg, ISSUES_DIR);

    const summaries: IssueSummary[] = await Promise.all(
      files.map(async (f) => {
        try {
          const raw = await getFileContent(cfg, f.path);
          const decoded = decodeContent(raw.content);
          const { data } = matter(decoded);

          return {
            slug: f.name.replace(/\.md$/, ""),
            title: (data.title as string) ?? f.name.replace(/\.md$/, ""),
            date: data.date ? new Date(data.date as string).toISOString() : undefined,
            endDate: data.endDate ? new Date(data.endDate as string).toISOString() : undefined,
            number: data.number ? String(data.number) : undefined,
            path: f.path,
            sha: f.sha,
          } satisfies IssueSummary;
        } catch {
          return {
            slug: f.name.replace(/\.md$/, ""),
            title: f.name.replace(/\.md$/, ""),
            path: f.path,
            sha: f.sha,
          } satisfies IssueSummary;
        }
      }),
    );

    // Sort newest first by date.
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
    console.error("[api/admin/issues] 500:", message, err instanceof Error ? err.stack : "");
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
