// ---------------------------------------------------------------------------
// /api/admin/contact
//   GET - read the singleton contact page file
//   PUT - update the singleton contact page file
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import {
  getGitHubConfig,
  getFileContent,
  decodeContent,
  updateFile,
} from "../../../lib/admin/github";
import { serializeContact } from "../../../lib/admin/serialize";
import type { FilePayload, SaveFileRequest, SaveFileResponse } from "../../../lib/admin/types";
import { parseMarkdown } from "../../../lib/admin/frontmatter";

const CONTACT_PATH = "src/content/contact/contact.md";

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasListText(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    return Boolean(
      item &&
        typeof item === "object" &&
        hasText((item as Record<string, unknown>).text),
    );
  });
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const raw = await getFileContent(cfg, CONTACT_PATH);
    const decoded = decodeContent(raw.content);
    const { data, content } = parseMarkdown(decoded);

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
  if (!hasText(body.frontmatter?.title)) errors.push("title is required");
  if (!hasText(body.frontmatter?.heading)) errors.push("heading is required");
  if (!hasText(body.frontmatter?.intro)) errors.push("intro is required");
  if (!hasText(body.frontmatter?.conditionsHeading)) {
    errors.push("conditionsHeading is required");
  }
  if (!hasListText(body.frontmatter?.bases)) errors.push("at least one base item is required");
  if (!hasListText(body.frontmatter?.conditions)) {
    errors.push("at least one condition item is required");
  }
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

    const fileContent = serializeContact(body.frontmatter, body.body ?? "");
    const result = await updateFile(
      cfg,
      body.path,
      fileContent,
      body.sha,
      "admin: update contacto",
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
