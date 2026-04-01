// ---------------------------------------------------------------------------
// Astro middleware – hostname canonicalization + Cloudflare Access auth
// ---------------------------------------------------------------------------
//
// HOSTNAME ROUTING
// ─────────────────
// This app is served from a single Cloudflare Worker. The canonical host for
// all traffic — both public and admin — is:
//
//   elgallogalante.com
//
// Other hostnames are redirected to the canonical host:
//
//   www.elgallogalante.com   →  redirect to elgallogalante.com (same path)
//   admin.elgallogalante.com →  redirect to elgallogalante.com
//                               (/ and /admin* → /admin, other paths preserved)
//
// CANONICAL ADMIN URL: https://elgallogalante.com/admin
//
// Admin routes on the canonical host:
//   elgallogalante.com /admin          → admin panel (Cloudflare Access JWT check)
//   elgallogalante.com /admin/*        → admin panel (Cloudflare Access JWT check)
//   elgallogalante.com /api/admin/*    → admin API   (Cloudflare Access JWT check)
//
// CLOUDFLARE ACCESS
// ──────────────────
// Cloudflare Access is configured on:
//   Application domain: elgallogalante.com
//   Path:               /admin*   (and /api/admin/* if desired)
//
// This middleware adds defense-in-depth by cryptographically verifying the
// Cf-Access-Jwt-Assertion JWT on every admin request that reaches the Worker.
//
// REQUIRED ENV VARS (Cloudflare dashboard + .dev.vars):
//   CLOUDFLARE_ACCESS_AUD         – Application Audience tag from Access
//   CLOUDFLARE_ACCESS_TEAM_DOMAIN – e.g. "myteam.cloudflareaccess.com"
//
// WORKERS.DEV BYPASS RISK:
//   workers.dev is disabled in wrangler.jsonc ("workers_dev": false).
//   The JWT check below guards all hostnames regardless.
// ---------------------------------------------------------------------------

import type { MiddlewareHandler } from "astro";
import { getAccessUser } from "./lib/auth/cloudflare-access";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANONICAL_HOST = "elgallogalante.com";
const WWW_HOST = "www.elgallogalante.com";
const LEGACY_ADMIN_HOST = "admin.elgallogalante.com";

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

/** True when the request is already on the canonical host. */
export function isCanonicalHost(hostname: string): boolean {
  return hostname === CANONICAL_HOST;
}

/** True for the www variant that should be redirected to canonical. */
export function isWwwHost(hostname: string): boolean {
  return hostname === WWW_HOST;
}

/** True for the legacy admin subdomain that is no longer the primary entry. */
export function isLegacyAdminHost(hostname: string): boolean {
  return hostname === LEGACY_ADMIN_HOST;
}

/** True when the pathname is an admin page route. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** True when the pathname is an admin API route. */
export function isAdminApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/admin/");
}

/** True for any admin page or API path. */
function isProtectedPath(pathname: string): boolean {
  return isAdminPath(pathname) || isAdminApiPath(pathname);
}

/** True for API routes (return JSON errors, not HTML redirects). */
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
  const { pathname, hostname, search } = url;

  // ── 1. Canonicalize hostname ─────────────────────────────────────────────

  // www → canonical (preserve full path + query string)
  if (isWwwHost(hostname)) {
    const canonical = new URL(`https://${CANONICAL_HOST}${pathname}${search}`);
    return context.redirect(canonical.toString(), 301);
  }

  // Legacy admin subdomain → canonical
  if (isLegacyAdminHost(hostname)) {
    // Bare root and explicit /admin both land on the canonical admin page.
    // Any other path (e.g. /admin/login-info, /api/admin/*) is preserved.
    const targetPath =
      pathname === "/" || pathname === "" ? "/admin" : pathname;
    const canonical = new URL(
      `https://${CANONICAL_HOST}${targetPath}${search}`,
    );
    return context.redirect(canonical.toString(), 301);
  }

  // ── 2. Auth-exempt paths pass through ────────────────────────────────────

  if (!isProtectedPath(pathname) || isAuthExempt(pathname)) {
    return next();
  }

  // ── 3. Cloudflare Access JWT verification ────────────────────────────────

  const env = (context.locals as any).runtime?.env ?? import.meta.env;
  const aud = env.CLOUDFLARE_ACCESS_AUD;
  const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN;

  // Development diagnostics – log presence of Cloudflare Access headers
  // without exposing token contents.
  if (import.meta.env.DEV) {
    const hasJwt = !!context.request.headers.get("Cf-Access-Jwt-Assertion");
    const hasEmail = !!context.request.headers.get(
      "Cf-Access-Authenticated-User-Email",
    );
    // eslint-disable-next-line no-console
    console.debug(
      `[auth] ${pathname} — Cf-Access-Jwt-Assertion: ${hasJwt}, Cf-Access-Authenticated-User-Email: ${hasEmail}`,
    );
  }

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
    return context.redirect("/admin/login-info?reason=missing-access-jwt");
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
    // Distinguish between a completely missing token and an invalid one so
    // the login-info page can show a contextual message.
    const hasToken =
      !!context.request.headers.get("Cf-Access-Jwt-Assertion") ||
      !!context.request.headers.get("Cookie")?.includes("CF_Authorization");
    const reason = hasToken ? "invalid-access-jwt" : "missing-access-jwt";
    return context.redirect(`/admin/login-info?reason=${reason}`);
  }

  // Attach verified editor to locals for downstream use.
  (context.locals as any).editor = user;

  return next();
};
