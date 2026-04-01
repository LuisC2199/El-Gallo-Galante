// ---------------------------------------------------------------------------
// Astro middleware – hostname-aware routing + Cloudflare Access auth
// ---------------------------------------------------------------------------
//
// HOSTNAME ROUTING
// ─────────────────
// This app is served from a single Cloudflare Worker under two hostnames:
//
//   admin.elgallogalante.com  →  admin panel (Cloudflare Access protected)
//   elgallogalante.com / www  →  public magazine site
//
// Rules enforced here:
//   1. admin.elgallogalante.com  /         → redirect to /admin
//   2. admin.elgallogalante.com  /admin*   → serve admin (after JWT check)
//   3. admin.elgallogalante.com  /api/admin/* → serve API (after JWT check)
//   4. www/main domain           /admin*   → redirect to admin subdomain
//   5. www/main domain           /*        → pass through (public site)
//
// CANONICAL ADMIN URL: https://admin.elgallogalante.com/admin
//
// CLOUDFLARE ACCESS
// ──────────────────
// Cloudflare Access (configured in the dashboard) is the primary gate.
// This middleware adds defense-in-depth by cryptographically verifying
// the Cf-Access-Jwt-Assertion JWT on every protected request.
//
// REQUIRED ENV VARS (set in Cloudflare dashboard + .dev.vars):
//   CLOUDFLARE_ACCESS_AUD         – Application Audience (AUD) tag from Access
//   CLOUDFLARE_ACCESS_TEAM_DOMAIN – e.g. "myteam.cloudflareaccess.com"
//
// CLOUDFLARE DASHBOARD SETUP:
//   1. Zero Trust > Access > Applications > Add Self-Hosted Application
//   2. Application domain: admin.elgallogalante.com  (hostname only, path "/")
//   3. Identity providers: Google
//   4. Policy: Allow → Emails matching your editors' addresses
//   5. Copy the "Application Audience (AUD) Tag" → CLOUDFLARE_ACCESS_AUD
//   6. Your team domain is shown in Zero Trust > Settings > Custom Pages
//
// WORKERS.DEV BYPASS RISK:
//   workers.dev is disabled in wrangler.jsonc ("workers_dev": false).
//   This middleware verifies the JWT server-side regardless of hostname,
//   so even direct Worker URL access is blocked.
// ---------------------------------------------------------------------------

import type { MiddlewareHandler } from "astro";
import { getAccessUser } from "./lib/auth/cloudflare-access";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_HOST = "admin.elgallogalante.com";
const MAIN_HOSTS = new Set(["elgallogalante.com", "www.elgallogalante.com"]);

// ---------------------------------------------------------------------------
// Route helpers (exported for tests / other modules if needed)
// ---------------------------------------------------------------------------

/** True when the request is on the dedicated admin subdomain. */
export function isAdminHost(hostname: string): boolean {
  return hostname === ADMIN_HOST;
}

/** True when the request is on the public-facing main domain. */
export function isMainSiteHost(hostname: string): boolean {
  return MAIN_HOSTS.has(hostname);
}

/** True when the pathname is an admin page or API route. */
export function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/")
  );
}

/** True for API routes (JSON responses rather than HTML redirects). */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/** The login-info page must be reachable without auth. */
function isAuthExempt(pathname: string): boolean {
  return pathname === "/admin/login-info" || pathname === "/admin/login-info/";
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export const onRequest: MiddlewareHandler = async (context, next) => {
  const url = new URL(context.request.url);
  const { pathname, hostname } = url;

  // ── 1. Hostname routing ──────────────────────────────────────────────────

  if (isMainSiteHost(hostname)) {
    // Redirect any attempt to reach /admin* on the public domain to the
    // canonical admin subdomain, preserving the path.
    if (isAdminPath(pathname)) {
      const adminUrl = new URL(pathname, `https://${ADMIN_HOST}`);
      return context.redirect(adminUrl.toString(), 301);
    }
    // All other public routes pass through untouched.
    return next();
  }

  if (isAdminHost(hostname)) {
    // Redirect bare root "/" to the admin panel.
    if (pathname === "/" || pathname === "") {
      return context.redirect("/admin", 302);
    }
    // Non-admin paths on the admin subdomain (e.g. someone typed a public
    // route directly) are not valid — return 404 via normal routing.
  }

  // ── 2. Auth-exempt paths pass through ────────────────────────────────────

  if (!isAdminPath(pathname) || isAuthExempt(pathname)) {
    return next();
  }

  // ── 3. Cloudflare Access JWT verification ────────────────────────────────

  const env = (context.locals as any).runtime?.env ?? import.meta.env;
  const aud = env.CLOUDFLARE_ACCESS_AUD;
  const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN;

  // Fail closed when env vars are absent.
  if (!aud || !teamDomain) {
    if (isApiRoute(pathname)) {
      return new Response(
        JSON.stringify({
          error: "Unauthenticated",
          detail: "Auth not configured",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    return context.redirect("/admin/login-info");
  }

  const user = await getAccessUser(context.request, {
    CLOUDFLARE_ACCESS_AUD: aud,
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: teamDomain,
  });

  if (!user) {
    if (isApiRoute(pathname)) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return context.redirect("/admin/login-info");
  }

  // Attach verified editor to locals for downstream use.
  (context.locals as any).editor = user;

  return next();
};
