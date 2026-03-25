// ---------------------------------------------------------------------------
// /api/admin/history/version
//   GET  – fetch file content at a specific commit
//     ?collection=posts|authors|issues&slug=my-slug&commitSha=abc123
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, getFileAtCommit } from "../../../../lib/admin/github";
import type { FileAtCommitResponse } from "../../../../lib/admin/types";
import matter from "gray-matter";

const COLLECTION_DIRS: Record<string, string> = {
  posts: "src/content/posts",
  authors: "src/content/authors",
  issues: "src/content/issues",
};

export const GET: APIRoute = async ({ url, locals }) => {
  const collection = url.searchParams.get("collection");
  const slug = url.searchParams.get("slug");
  const commitSha = url.searchParams.get("commitSha");

  if (!collection || !slug || !commitSha || !COLLECTION_DIRS[collection]) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid collection/slug/commitSha" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const filePath = `${COLLECTION_DIRS[collection]}/${slug}.md`;
    const raw = await getFileAtCommit(cfg, filePath, commitSha);
    const { data, content } = matter(raw);

    const body: FileAtCommitResponse = {
      frontmatter: data as Record<string, unknown>,
      body: content,
    };

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
