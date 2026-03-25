// ---------------------------------------------------------------------------
// POST /api/admin/authors/create – create a new author
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, listFiles, createTextFile } from "../../../../lib/admin/github";
import { serializeAuthor } from "../../../../lib/admin/serialize";
import { slugify, uniqueSlug } from "../../../../lib/admin/slugify";
import type { CreateItemResponse } from "../../../../lib/admin/types";

const AUTHORS_DIR = "src/content/authors";

export const POST: APIRoute = async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // --- Validation ---
  if (!body.name || String(body.name).trim() === "") {
    return jsonError("name is required", 422);
  }

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    // --- Generate unique slug ---
    const baseSlug = slugify(String(body.name));
    if (!baseSlug) return jsonError("Could not generate slug from name", 422);

    const existing = await listFiles(cfg, AUTHORS_DIR);
    const existingSlugs = new Set(existing.map((f) => f.name.replace(/\.md$/, "")));
    const slug = uniqueSlug(baseSlug, existingSlugs);

    // --- Build frontmatter ---
    const frontmatter: Record<string, unknown> = {
      name: String(body.name).trim(),
      birthYear: body.birthYear ? String(body.birthYear) : undefined,
      birthPlace: body.birthPlace ? String(body.birthPlace) : undefined,
    };

    // --- Serialize & create ---
    const content = serializeAuthor(frontmatter, "");
    const filePath = `${AUTHORS_DIR}/${slug}.md`;

    const result = await createTextFile(
      cfg,
      filePath,
      content,
      `admin: create author ${slug}`,
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
