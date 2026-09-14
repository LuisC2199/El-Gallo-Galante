// ---------------------------------------------------------------------------
// GET /api/admin/posts – list all posts with summary data
// ---------------------------------------------------------------------------
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, listFiles, getFileContent, decodeContent } from "../../../../lib/admin/github";
import type { CollectionItemSummary } from "../../../../lib/admin/types";
import { parseMarkdown } from "../../../../lib/admin/frontmatter";

const POSTS_DIR = "src/content/posts";
const SUMMARY_CONCURRENCY = 6;
const SUMMARY_FETCH_ATTEMPTS = 3;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryGitHubRead(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /GitHub API (403|429|5\d\d):/.test(message) ||
    /fetch failed|network|timed out|timeout/i.test(message)
  );
}

async function getFileContentWithRetry(
  cfg: ReturnType<typeof getGitHubConfig>,
  filePath: string,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= SUMMARY_FETCH_ATTEMPTS; attempt++) {
    try {
      return await getFileContent(cfg, filePath);
    } catch (err) {
      lastError = err;
      if (attempt === SUMMARY_FETCH_ATTEMPTS || !shouldRetryGitHubRead(err)) {
        throw err;
      }
      await wait(150 * attempt);
    }
  }

  throw lastError;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const env = (locals as any).runtime?.env ?? import.meta.env;
    const cfg = getGitHubConfig(env);

    const files = await listFiles(cfg, POSTS_DIR);

    // Fetch each file's content to extract frontmatter summary data.
    // For large collections consider paginating or caching; fine for now.
    const summaries: CollectionItemSummary[] = await mapWithConcurrency(
      files,
      SUMMARY_CONCURRENCY,
      async (f) => {
        try {
          const raw = await getFileContentWithRetry(cfg, f.path);
          const decoded = decodeContent(raw.content);
          const { data } = parseMarkdown(decoded);

          return {
            slug: f.name.replace(/\.md$/, ""),
            filename: f.name,
            path: f.path,
            title: data.title as string | undefined,
            date: data.date ? new Date(data.date as string).toISOString() : undefined,
            category: data.category as string | undefined,
            status: (data.status as string | undefined) ?? "published",
            author: data.author as string | undefined,
            issue: data.issue as string | undefined,
            sha: f.sha,
          } satisfies CollectionItemSummary;
        } catch (err) {
          console.warn(
            "[api/admin/posts] summary fallback:",
            f.path,
            err instanceof Error ? err.message : String(err),
          );
          // If an individual file fails to parse, return minimal info.
          return {
            slug: f.name.replace(/\.md$/, ""),
            filename: f.name,
            path: f.path,
            sha: f.sha,
          } satisfies CollectionItemSummary;
        }
      },
    );

    // Sort newest first.
    summaries.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    return new Response(JSON.stringify(summaries), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/admin/posts] 500:", message, err instanceof Error ? err.stack : "");
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
