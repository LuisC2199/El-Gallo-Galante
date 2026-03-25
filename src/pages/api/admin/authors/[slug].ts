// ---------------------------------------------------------------------------
// /api/admin/authors/[slug]
//   GET    – read a single author file
//   PUT    – update a single author file
//   DELETE – delete a single author file
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, getFileContent, decodeContent, updateFile, deleteFile } from "../../../../lib/admin/github";
import { serializeAuthor } from "../../../../lib/admin/serialize";
import type { FilePayload, SavePostResponse } from "../../../../lib/admin/types";
import matter from "gray-matter";

const AUTHORS_DIR = "src/content/authors";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export const GET: APIRoute = async ({ params, locals }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const filePath = `${AUTHORS_DIR}/${slug}.md`;
    const raw = await getFileContent(cfg, filePath);
    const decoded = decodeContent(raw.content);
    const { data, content } = matter(decoded);

    const payload: FilePayload = {
      path: raw.path,
      sha: raw.sha,
      frontmatter: data as Record<string, unknown>,
      body: content,
    };

    return new Response(JSON.stringify(payload), {
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

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { path: string; sha: string; frontmatter: Record<string, unknown>; body: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const errors: string[] = [];
  if (!body.frontmatter?.name) errors.push("name is required");
  if (!body.sha) errors.push("sha is required");
  if (!body.path) errors.push("path is required");

  if (errors.length > 0) {
    return new Response(JSON.stringify({ error: errors.join("; ") }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const fileContent = serializeAuthor(body.frontmatter, body.body);
    const commitMessage = `admin: update author ${slug}`;

    const result = await updateFile(cfg, body.path, fileContent, body.sha, commitMessage);

    const response: SavePostResponse = {
      sha: result.content.sha,
      path: result.content.path,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("409") ? 409 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { sha: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.sha) {
    return new Response(JSON.stringify({ error: "sha is required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);
    const filePath = `${AUTHORS_DIR}/${slug}.md`;

    await deleteFile(cfg, filePath, body.sha, `admin: delete author ${slug}`);

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("404") ? 404 : message.includes("409") ? 409 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
