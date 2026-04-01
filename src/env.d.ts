/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  // GitHub API
  readonly GITHUB_TOKEN: string;
  readonly GITHUB_OWNER: string;
  readonly GITHUB_REPO: string;
  readonly GITHUB_BRANCH?: string;

  // Cloudflare Access JWT verification
  readonly CLOUDFLARE_ACCESS_AUD: string;
  readonly CLOUDFLARE_ACCESS_TEAM_DOMAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
