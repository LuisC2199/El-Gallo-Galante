// ---------------------------------------------------------------------------
// POST /api/admin/media – upload an image to the GitHub repo
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, createBinaryFile } from "../../../lib/admin/github";
import type { MediaUploadTarget, MediaUploadResponse } from "../../../lib/admin/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Maps a target to its repo directory and public-path prefix. */
const TARGET_MAP: Record<MediaUploadTarget, { repoDir: string; publicPrefix: string }> = {
  posts:   { repoDir: "public/posts",   publicPrefix: "/posts" },
  authors: { repoDir: "public/authors", publicPrefix: "/authors" },
  covers:  { repoDir: "public/covers",  publicPrefix: "/covers" },
};

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Slugify a filename: lowercase, strip diacritics, keep only safe chars. */
function slugifyFilename(raw: string): string {
  const dot = raw.lastIndexOf(".");
  const ext = dot !== -1 ? raw.slice(dot + 1).toLowerCase() : "";
  const base = dot !== -1 ? raw.slice(0, dot) : raw;

  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")       // non-alphanumeric → dash
    .replace(/^-+|-+$/g, "");          // trim leading/trailing dashes

  return ext ? `${slug}.${ext}` : slug;
}

function isValidTarget(v: unknown): v is MediaUploadTarget {
  return typeof v === "string" && v in TARGET_MAP;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    // ---- Parse multipart form data ----
    const formData = await request.formData();
    const file = formData.get("file");
    const target = formData.get("target");

    if (!(file instanceof File) || file.size === 0) {
      return jsonError("No file provided", 400);
    }

    if (!isValidTarget(target)) {
      return jsonError(`Invalid target. Must be one of: ${Object.keys(TARGET_MAP).join(", ")}`, 400);
    }

    // ---- Validate file ----
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return jsonError(
        `Unsupported file type ".${ext}". Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
        400,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`, 400);
    }

    // ---- Prepare paths ----
    const safeFilename = slugifyFilename(file.name);
    const { repoDir, publicPrefix } = TARGET_MAP[target];
    const repoPath = `${repoDir}/${safeFilename}`;
    const publicPath = `${publicPrefix}/${safeFilename}`;

    // ---- Read file bytes ----
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // ---- Commit to GitHub ----
    const result = await createBinaryFile(
      cfg,
      repoPath,
      bytes,
      `admin: upload ${publicPath}`,
    );

    const response: MediaUploadResponse = {
      publicPath,
      sha: result.content.sha,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // GitHub returns 422 if the file already exists (SHA conflict)
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
