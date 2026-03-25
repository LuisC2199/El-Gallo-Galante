// ---------------------------------------------------------------------------
// GET /api/admin/authors – list all authors with summary data
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, listFiles, getFileContent, decodeContent } from "../../../../lib/admin/github";
import type { AuthorSummary } from "../../../../lib/admin/types";
import matter from "gray-matter";

const AUTHORS_DIR = "src/content/authors";

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const files = await listFiles(cfg, AUTHORS_DIR);

    const summaries: AuthorSummary[] = await Promise.all(
      files.map(async (f) => {
        try {
          const raw = await getFileContent(cfg, f.path);
          const decoded = decodeContent(raw.content);
          const { data } = matter(decoded);

          return {
            slug: f.name.replace(/\.md$/, ""),
            name: (data.name as string) ?? f.name.replace(/\.md$/, ""),
            birthYear: data.birthYear ? String(data.birthYear) : undefined,
            birthPlace: data.birthPlace ? String(data.birthPlace) : undefined,
            path: f.path,
            sha: f.sha,
          } satisfies AuthorSummary;
        } catch {
          return {
            slug: f.name.replace(/\.md$/, ""),
            name: f.name.replace(/\.md$/, ""),
            path: f.path,
            sha: f.sha,
          } satisfies AuthorSummary;
        }
      }),
    );

    summaries.sort((a, b) => a.name.localeCompare(b.name, "es"));

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
