// ---------------------------------------------------------------------------
// /api/admin/history
//   GET  – fetch commit history for a file
//     ?collection=posts|authors|issues&slug=my-slug
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, getFileHistory } from "../../../lib/admin/github";
import type { FileHistoryResponse } from "../../../lib/admin/types";

const COLLECTION_DIRS: Record<string, string> = {
  posts: "src/content/posts",
  authors: "src/content/authors",
  issues: "src/content/issues",
};

export const GET: APIRoute = async ({ url, locals }) => {
  const collection = url.searchParams.get("collection");
  const slug = url.searchParams.get("slug");

  if (!collection || !slug || !COLLECTION_DIRS[collection]) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid collection/slug parameters" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const filePath = `${COLLECTION_DIRS[collection]}/${slug}.md`;
    const commits = await getFileHistory(cfg, filePath);

    const body: FileHistoryResponse = { commits };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("404") ? 404 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
