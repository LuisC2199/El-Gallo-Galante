// ---------------------------------------------------------------------------
// POST /api/admin/authors/duplicate – duplicate an existing author
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import {
  getGitHubConfig,
  getFileContent,
  decodeContent,
  listFiles,
  createTextFile,
} from "../../../../lib/admin/github";
import { serializeAuthor } from "../../../../lib/admin/serialize";
import { uniqueSlug } from "../../../../lib/admin/slugify";
import type { CreateItemResponse } from "../../../../lib/admin/types";
import matter from "gray-matter";

const AUTHORS_DIR = "src/content/authors";

export const POST: APIRoute = async ({ request, locals }) => {
  let body: { slug: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.slug) return jsonError("slug is required", 422);

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    // Read source file
    const sourcePath = `${AUTHORS_DIR}/${body.slug}.md`;
    const raw = await getFileContent(cfg, sourcePath);
    const decoded = decodeContent(raw.content);
    const { data: frontmatter, content: mdBody } = matter(decoded);

    // Generate unique slug
    const existing = await listFiles(cfg, AUTHORS_DIR);
    const existingSlugs = new Set(existing.map((f) => f.name.replace(/\.md$/, "")));
    const newSlug = uniqueSlug(`${body.slug}-copy`, existingSlugs);

    // Update name to indicate it's a copy
    const fm = { ...frontmatter };
    fm.name = `${fm.name ?? body.slug} (copy)`;

    // Serialize & create
    const fileContent = serializeAuthor(fm as Record<string, unknown>, mdBody);
    const filePath = `${AUTHORS_DIR}/${newSlug}.md`;

    const result = await createTextFile(
      cfg,
      filePath,
      fileContent,
      `admin: duplicate author ${body.slug} → ${newSlug}`,
    );

    const response: CreateItemResponse = {
      slug: newSlug,
      path: result.content.path,
      sha: result.content.sha,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("404") ? 404 : 500;
    return jsonError(message, status);
  }
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
