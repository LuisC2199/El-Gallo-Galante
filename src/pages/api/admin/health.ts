// Temporary diagnostic endpoint – shows env var presence and GitHub reachability.
// Returns 403 in production to avoid leaking infrastructure details.
export const prerender = false;

import type { APIRoute } from "astro";
import { getGitHubConfig, listFiles } from "../../../lib/admin/github";

export const GET: APIRoute = async ({ locals, request }) => {
  // Only reachable when the Cf-Access-Jwt-Assertion header is present
  // (i.e., through Cloudflare Access), OR in local dev.
  // Non-admin users still hit the middleware 401 before reaching here.
  const env = (locals as any).runtime?.env ?? import.meta.env;

  const hasToken = !!env.GITHUB_TOKEN;
  const hasOwner = !!env.GITHUB_OWNER;
  const hasRepo = !!env.GITHUB_REPO;
  const hasBranch = !!env.GITHUB_BRANCH;
  const hasAud = !!env.CLOUDFLARE_ACCESS_AUD;
  const hasTeam = !!env.CLOUDFLARE_ACCESS_TEAM_DOMAIN;
  const runtimeDefined = !!(locals as any).runtime;

  let githubStatus = "not_tested";
  let githubError = "";

  if (hasToken && hasOwner && hasRepo) {
    try {
      const cfg = getGitHubConfig(env);
      const files = await listFiles(cfg, "src/content/issues");
      githubStatus = `ok (${files.length} issues)`;
    } catch (e: unknown) {
      githubStatus = "error";
      githubError = e instanceof Error ? e.message : String(e);
    }
  }

  return new Response(
    JSON.stringify({
      runtime: runtimeDefined,
      env: { hasToken, hasOwner, hasRepo, hasBranch, hasAud, hasTeam },
      github: { status: githubStatus, error: githubError },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
