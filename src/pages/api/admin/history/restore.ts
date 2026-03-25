// ---------------------------------------------------------------------------
// /api/admin/history/restore
//   POST – restore a file to a specific historical version
//
//   Body: { collection, slug, sha, commitSha }
//     sha       = current blob SHA (for safe update)
//     commitSha = commit SHA of the version to restore
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import {
  getGitHubConfig,
  getFileAtCommit,
  updateFile,
  getFileContent,
  decodeContent,
} from "../../../../lib/admin/github";
import type { RestoreResponse } from "../../../../lib/admin/types";
import matter from "gray-matter";

const COLLECTION_DIRS: Record<string, string> = {
  posts: "src/content/posts",
  authors: "src/content/authors",
  issues: "src/content/issues",
};

export const POST: APIRoute = async ({ request, locals }) => {
  let body: {
    collection: string;
    slug: string;
    sha: string;
    commitSha: string;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { collection, slug, sha, commitSha } = body;

  if (!collection || !slug || !sha || !commitSha || !COLLECTION_DIRS[collection]) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: collection, slug, sha, commitSha" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const filePath = `${COLLECTION_DIRS[collection]}/${slug}.md`;

    // Fetch the historical content
    const historicalContent = await getFileAtCommit(cfg, filePath, commitSha);

    // Write it back as a new commit
    const shortSha = commitSha.slice(0, 8);
    const message = `Restore ${collection}/${slug} to version ${shortSha}`;
    const result = await updateFile(cfg, filePath, historicalContent, sha, message);

    // Parse for the response so the editor can reload
    const { data, content } = matter(historicalContent);

    const response: RestoreResponse = {
      sha: result.content.sha,
      path: result.content.path,
      frontmatter: data as Record<string, unknown>,
      body: content,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("409") ? 409 : message.includes("404") ? 404 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
