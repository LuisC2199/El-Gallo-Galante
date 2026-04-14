// ---------------------------------------------------------------------------
// /api/admin/preamble
//   GET – read the singleton preamble file
//   PUT – update the singleton preamble file
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import {
  getGitHubConfig,
  getFileContent,
  decodeContent,
  updateFile,
} from "../../../lib/admin/github";
import { serializePreamble } from "../../../lib/admin/serialize";
import type { FilePayload, SaveFileRequest, SaveFileResponse } from "../../../lib/admin/types";
import matter from "gray-matter";

const PREAMBLE_PATH = "src/content/preamble/preamble.md";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const raw = await getFileContent(cfg, PREAMBLE_PATH);
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
export const PUT: APIRoute = async ({ request, locals }) => {
  let body: SaveFileRequest;
  try {
    body = (await request.json()) as SaveFileRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const errors: string[] = [];
  if (!body.frontmatter?.title) errors.push("title is required");
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

    const fileContent = serializePreamble(body.frontmatter, body.body);
    const result = await updateFile(
      cfg,
      body.path,
      fileContent,
      body.sha,
      "admin: update preámbulo",
    );

    const response: SaveFileResponse = {
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
