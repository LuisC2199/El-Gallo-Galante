// ---------------------------------------------------------------------------
// Admin – shared TypeScript types
// ---------------------------------------------------------------------------

/** Minimal summary returned when listing collection items. */
export interface CollectionItemSummary {
  /** Filename without extension, used as the slug. */
  slug: string;
  /** Original filename including extension. */
  filename: string;
  /** Path relative to the repo root (e.g. "src/content/posts/foo.md"). */
  path: string;
  /** Post title extracted from frontmatter, if available. */
  title?: string;
  /** ISO-8601 date string extracted from frontmatter, if available. */
  date?: string;
  /** Git blob SHA – needed for future update operations. */
  sha: string;
  /** Post category (Poesía, Narrativa, etc.). */
  category?: string;
  /** Publication status (draft, review, published). */
  status?: string;
  /** Author slug from frontmatter. */
  author?: string;
  /** Issue slug from frontmatter. */
  issue?: string;
}

/** Summary for an author, used in lists and relation pickers. */
export interface AuthorSummary {
  slug: string;
  name: string;
  birthYear?: string;
  birthPlace?: string;
  path: string;
  sha: string;
}

/** Summary for an issue, used in lists and relation pickers. */
export interface IssueSummary {
  slug: string;
  title: string;
  date?: string;
  endDate?: string;
  number?: string;
  path: string;
  sha: string;
}

/** Full payload returned when reading a single file. */
export interface FilePayload {
  /** Path relative to the repo root. */
  path: string;
  /** Git blob SHA. */
  sha: string;
  /** Parsed YAML frontmatter as a plain object. */
  frontmatter: Record<string, unknown>;
  /** Raw Markdown body (everything after the closing `---`). */
  body: string;
}

// ---------------------------------------------------------------------------
// Post frontmatter (mirrors the Zod schema in src/content/config.ts)
// ---------------------------------------------------------------------------

export interface PostPresentacion {
  dropCapMode?: "auto" | "none" | "manual";
  dedicatoria?: string;
  epigrafe?: string;
  epigrafeAutor?: string;
  metaEpistolar?: string;
  firma?: string;
}

export type PostCategory =
  | "Poesía"
  | "Narrativa"
  | "Crítica"
  | "Ensayo"
  | "Epistolario";

export type PostStatus = "draft" | "review" | "published";

export interface PostFrontmatter {
  title: string;
  date: string;
  category: PostCategory;
  status?: PostStatus;
  issue: string;
  author: string;
  traductor?: string;
  excerpt?: string;
  presentacion?: PostPresentacion;
  coverImage?: string;
  featuredImage?: string;
  imagePosition?: "top" | "center" | "bottom";
}

// ---------------------------------------------------------------------------
// GitHub configuration
// ---------------------------------------------------------------------------

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

// ---------------------------------------------------------------------------
// GitHub Contents API response shapes (subset we care about)
// ---------------------------------------------------------------------------

export interface GitHubFileEntry {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  download_url: string | null;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string; // base64-encoded
  encoding: "base64";
}

// ---------------------------------------------------------------------------
// Save request / response
// ---------------------------------------------------------------------------

/**
 * Generic request body for any file-update endpoint (posts, preamble, etc.).
 * Kept as SavePostRequest for backwards compatibility with existing callers.
 */
export interface SavePostRequest {
  path: string;
  sha: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/** @alias SavePostRequest – prefer this name in non-post contexts. */
export type SaveFileRequest = SavePostRequest;

/**
 * Generic response returned after a successful file save.
 * Kept as SavePostResponse for backwards compatibility with existing callers.
 */
export interface SavePostResponse {
  sha: string;
  path: string;
}

/** @alias SavePostResponse – prefer this name in non-post contexts. */
export type SaveFileResponse = SavePostResponse;

/** Response for update file via GitHub Contents API. */
export interface GitHubUpdateResponse {
  content: {
    name: string;
    path: string;
    sha: string;
  };
  commit: {
    sha: string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Media upload
// ---------------------------------------------------------------------------

/** Target collection for media uploads. */
export type MediaUploadTarget = "posts" | "authors" | "covers";

/** Successful response from POST /api/admin/media. */
export interface MediaUploadResponse {
  /** Public path to use in frontmatter (e.g. "/posts/my-image.jpg"). */
  publicPath: string;
  /** Git blob SHA of the newly created file. */
  sha: string;
}

// ---------------------------------------------------------------------------
// Create item
// ---------------------------------------------------------------------------

/** Response returned after successfully creating a new collection item. */
export interface CreateItemResponse {
  slug: string;
  path: string;
  sha: string;
}

// ---------------------------------------------------------------------------
// Delete item
// ---------------------------------------------------------------------------

/** Response shape from the GitHub Contents API DELETE endpoint. */
export interface GitHubDeleteResponse {
  commit: {
    sha: string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Commit history
// ---------------------------------------------------------------------------

/** A single commit entry from the GitHub Commits API. */
export interface CommitEntry {
  sha: string;
  message: string;
  date: string;
  authorName: string;
}

/** Response from the file history endpoint. */
export interface FileHistoryResponse {
  commits: CommitEntry[];
}

/** Response from the file-at-commit endpoint. */
export interface FileAtCommitResponse {
  frontmatter: Record<string, unknown>;
  body: string;
}

/** Request body for the restore endpoint. */
export interface RestoreRequest {
  /** Current blob SHA for safe update. */
  sha: string;
  /** Path relative to repo root. */
  path: string;
  /** Commit SHA of the version to restore. */
  commitSha: string;
}

/** Response from the restore endpoint. */
export interface RestoreResponse {
  sha: string;
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
}
