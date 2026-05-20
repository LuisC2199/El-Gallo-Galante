# El Gallo Galante

Digital magazine site for El Gallo Galante. The app publishes issues, posts,
authors, categories, and a custom admin panel for authorized editors.

## Stack

- Astro 5 with the Cloudflare adapter
- React admin UI mounted at `/admin`
- Astro content collections for posts, authors, issues, and the preamble
- GitHub Contents API for admin reads/writes
- Cloudflare Access for admin authentication

## Content Model

Markdown content lives under `src/content`:

- `posts/`: articles and literary works
- `authors/`: author profiles and biographies
- `issues/`: magazine issues with optional featured post slugs
- `preamble/`: singleton preamble page

Static media lives under `public`:

- `public/posts/`
- `public/authors/`
- `public/covers/`

Posts link to authors through Astro content references. Posts link to issues by
the issue slug stored in post frontmatter.

## Admin

The admin panel is served from `/admin` and uses API routes under
`/api/admin/*`. It edits Markdown files in GitHub, preserving concurrency with
GitHub blob SHAs.

Detailed admin architecture is documented in:

- `docs/admin-architecture.md`

## Commands

```sh
npm install
npm run dev
npm run build
npm run preview
```

## Environment

Admin API routes require GitHub repository credentials:

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` optional, defaults to `main`

Admin authentication requires Cloudflare Access settings:

- `CLOUDFLARE_ACCESS_AUD`
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN`
