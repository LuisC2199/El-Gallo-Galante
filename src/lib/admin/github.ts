// ---------------------------------------------------------------------------
// GitHub API wrapper – thin layer over the GitHub Contents API
// ---------------------------------------------------------------------------
//
// Required environment variables (set in wrangler.jsonc secrets or .dev.vars):
//
//   GITHUB_TOKEN   – Personal access token (classic) with `repo` scope,
//                    or a fine-grained token with Contents read access.
//   GITHUB_OWNER   – Repository owner (user or organisation).
//   GITHUB_REPO    – Repository name.
//   GITHUB_BRANCH  – Branch to read from (default: "main").
//
// ---------------------------------------------------------------------------

import type {
  GitHubConfig,
  GitHubFileEntry,
  GitHubFileContent,
  GitHubUpdateResponse,
  GitHubDeleteResponse,
  CommitEntry,
} from "./types";

const API_BASE = "https://api.github.com";

/**
 * Build a {@link GitHubConfig} from environment variables.
 *
 * In Astro API routes running on Cloudflare Workers the env object is
 * available via `Astro.locals.runtime.env`.  During `astro dev` you can
 * use a `.dev.vars` file (Cloudflare convention) or a regular `.env`.
 */
export function getGitHubConfig(env: Record<string, string | undefined>): GitHubConfig {
  const token = env.GITHUB_TOKEN;
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH ?? "main";

  if (!token || !owner || !repo) {
    throw new Error(
      "Missing required GitHub env vars. " +
        "Ensure GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO are set.",
    );
  }

  return { token, owner, repo, branch };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function headers(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function contentsUrl(cfg: GitHubConfig, path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `${API_BASE}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cleanPath}?ref=${encodeURIComponent(cfg.branch)}`;
}

async function ghFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List files in a directory.
 *
 * Returns only entries whose `type` is `"file"` and whose name ends with
 * the given extension (default `.md`).
 */
export async function listFiles(
  cfg: GitHubConfig,
  dirPath: string,
  ext = ".md",
): Promise<GitHubFileEntry[]> {
  const entries = await ghFetch<GitHubFileEntry[]>(
    contentsUrl(cfg, dirPath),
    cfg.token,
  );

  return entries.filter((e) => e.type === "file" && e.name.endsWith(ext));
}

/**
 * Fetch the raw (base-64 encoded) content of a single file.
 */
export async function getFileContent(
  cfg: GitHubConfig,
  filePath: string,
): Promise<GitHubFileContent> {
  return ghFetch<GitHubFileContent>(contentsUrl(cfg, filePath), cfg.token);
}

/**
 * Decode base-64 content returned by the GitHub Contents API.
 *
 * UTF-8 safety note:
 *   atob() decodes base64 → raw bytes represented as a Latin-1 binary string
 *   (one JS char per byte).  Because GitHub stores files as UTF-8, multi-byte
 *   sequences (é = 0xC3 0xA9, í = 0xC3 0xAD, ñ = 0xC3 0xB1 …) would each
 *   become two garbled Latin-1 characters ("Ã©", "Ã­", "Ã±" …) if we returned
 *   the atob result directly.  Passing those bytes through TextDecoder("utf-8")
 *   reconstructs the correct Unicode string.
 *
 *   The inverse (encoding) is done with TextEncoder → btoa, which is already
 *   applied in updateFile() and createTextFile().
 */
export function decodeContent(base64: string): string {
  // Strip the newlines GitHub sprinkles into the base64 payload.
  const cleaned = base64.replace(/\n/g, "");
  // Decode base64 → raw bytes (Latin-1 binary string, one char per byte).
  const binary = atob(cleaned);
  // Re-interpret the raw bytes as UTF-8 so accented characters survive intact.
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Update (or create) a file via the GitHub Contents API.
 *
 * Requires the current `sha` of the file for safe updates.
 * Returns the new file SHA and commit info.
 */
export async function updateFile(
  cfg: GitHubConfig,
  filePath: string,
  content: string,
  sha: string,
  message: string,
): Promise<GitHubUpdateResponse> {
  const url = contentsUrl(cfg, filePath).replace(/\?ref=.*$/, "");
  // Encode UTF-8 content to base64 safely
  const bytes = new TextEncoder().encode(content);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const encoded = btoa(binary);

  const res = await fetch(url, {
    method: "PUT",
    headers: headers(cfg.token),
    body: JSON.stringify({
      message,
      content: encoded,
      sha,
      branch: cfg.branch,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }

  return res.json() as Promise<GitHubUpdateResponse>;
}

/**
 * Create a new binary file in the repo via the GitHub Contents API.
 *
 * Unlike {@link updateFile}, this does not require a SHA (the file must not
 * already exist).  The content is provided as a `Uint8Array` and is
 * base-64 encoded for the API request.
 */
export async function createBinaryFile(
  cfg: GitHubConfig,
  filePath: string,
  content: Uint8Array,
  message: string,
): Promise<GitHubUpdateResponse> {
  const url = contentsUrl(cfg, filePath).replace(/\?ref=.*$/, "");

  // Encode binary bytes → base64
  const binary = Array.from(content, (b) => String.fromCharCode(b)).join("");
  const encoded = btoa(binary);

  const res = await fetch(url, {
    method: "PUT",
    headers: headers(cfg.token),
    body: JSON.stringify({
      message,
      content: encoded,
      branch: cfg.branch,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }

  return res.json() as Promise<GitHubUpdateResponse>;
}

/**
 * Create a new UTF-8 text file in the repo via the GitHub Contents API.
 *
 * The file must not already exist. For binary content use
 * {@link createBinaryFile} instead.
 */
export async function createTextFile(
  cfg: GitHubConfig,
  filePath: string,
  content: string,
  message: string,
): Promise<GitHubUpdateResponse> {
  const url = contentsUrl(cfg, filePath).replace(/\?ref=.*$/, "");
  const bytes = new TextEncoder().encode(content);
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const encoded = btoa(bin);

  const res = await fetch(url, {
    method: "PUT",
    headers: headers(cfg.token),
    body: JSON.stringify({
      message,
      content: encoded,
      branch: cfg.branch,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errBody}`);
  }

  return res.json() as Promise<GitHubUpdateResponse>;
}

/**
 * Delete a file from the repo via the GitHub Contents API.
 *
 * Requires the current `sha` of the file for safe deletion.
 */
export async function deleteFile(
  cfg: GitHubConfig,
  filePath: string,
  sha: string,
  message: string,
): Promise<GitHubDeleteResponse> {
  const url = contentsUrl(cfg, filePath).replace(/\?ref=.*$/, "");

  const res = await fetch(url, {
    method: "DELETE",
    headers: headers(cfg.token),
    body: JSON.stringify({
      message,
      sha,
      branch: cfg.branch,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errBody}`);
  }

  return res.json() as Promise<GitHubDeleteResponse>;
}

// ---------------------------------------------------------------------------
// Commit history
// ---------------------------------------------------------------------------

/**
 * Fetch the commit history for a single file.
 *
 * Uses the GitHub Commits API with the `path` query parameter.
 * Returns most-recent-first, limited to `perPage` entries.
 */
export async function getFileHistory(
  cfg: GitHubConfig,
  filePath: string,
  perPage = 30,
): Promise<CommitEntry[]> {
  const cleanPath = filePath.replace(/^\/+/, "");
  const url =
    `${API_BASE}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/commits` +
    `?sha=${encodeURIComponent(cfg.branch)}` +
    `&path=${encodeURIComponent(cleanPath)}` +
    `&per_page=${perPage}`;

  interface RawCommit {
    sha: string;
    commit: {
      message: string;
      author: { name: string; date: string } | null;
      committer: { name: string; date: string } | null;
    };
  }

  const raw = await ghFetch<RawCommit[]>(url, cfg.token);

  return raw.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    date: (c.commit.author?.date ?? c.commit.committer?.date) || "",
    authorName: (c.commit.author?.name ?? c.commit.committer?.name) || "Unknown",
  }));
}

/**
 * Fetch the raw content of a file at a specific commit SHA.
 *
 * Uses the GitHub Contents API with `ref` set to the commit SHA.
 * Returns the decoded UTF-8 string.
 */
export async function getFileAtCommit(
  cfg: GitHubConfig,
  filePath: string,
  commitSha: string,
): Promise<string> {
  const cleanPath = filePath.replace(/^\/+/, "");
  const url =
    `${API_BASE}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cleanPath}` +
    `?ref=${encodeURIComponent(commitSha)}`;

  const raw = await ghFetch<GitHubFileContent>(url, cfg.token);
  return decodeContent(raw.content);
}