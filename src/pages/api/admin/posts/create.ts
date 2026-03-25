// ---------------------------------------------------------------------------
// POST /api/admin/posts/create – create a new post
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, listFiles, createTextFile } from "../../../../lib/admin/github";
import { serializePost } from "../../../../lib/admin/serialize";
import { slugify, uniqueSlug } from "../../../../lib/admin/slugify";
import type { CreateItemResponse } from "../../../../lib/admin/types";

const POSTS_DIR = "src/content/posts";

export const POST: APIRoute = async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // --- Validation ---
  const errors: string[] = [];
  if (!body.title || String(body.title).trim() === "") errors.push("title is required");
  if (!body.date || String(body.date).trim() === "") errors.push("date is required");
  if (!body.category || String(body.category).trim() === "") errors.push("category is required");
  if (!body.author || String(body.author).trim() === "") errors.push("author is required");

  if (errors.length > 0) {
    return jsonError(errors.join("; "), 422);
  }

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    // --- Generate unique slug ---
    const baseSlug = slugify(String(body.title));
    if (!baseSlug) return jsonError("Could not generate slug from title", 422);

    const existing = await listFiles(cfg, POSTS_DIR);
    const existingSlugs = new Set(existing.map((f) => f.name.replace(/\.md$/, "")));
    const slug = uniqueSlug(baseSlug, existingSlugs);

    // --- Build frontmatter ---
    const frontmatter: Record<string, unknown> = {
      title: String(body.title).trim(),
      date: String(body.date),
      category: String(body.category),
      issue: body.issue ? String(body.issue) : undefined,
      author: String(body.author),
      traductor: body.traductor ? String(body.traductor) : undefined,
    };

    // --- Serialize & create ---
    const content = serializePost(frontmatter, "");
    const filePath = `${POSTS_DIR}/${slug}.md`;

    const result = await createTextFile(
      cfg,
      filePath,
      content,
      `admin: create post ${slug}`,
    );

    const response: CreateItemResponse = {
      slug,
      path: result.content.path,
      sha: result.content.sha,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("422") ? 409 : 500;
    return jsonError(message, status);
  }
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
