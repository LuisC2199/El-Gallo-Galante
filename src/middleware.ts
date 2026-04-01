// ---------------------------------------------------------------------------
// Astro middleware – Cloudflare Access authentication for /admin routes
// ---------------------------------------------------------------------------
//
// Cloudflare Access (configured in the dashboard) is the primary gate.
// This middleware provides defense-in-depth by cryptographically verifying
// the Cf-Access-Jwt-Assertion JWT on protected routes.
//
// REQUIRED ENV VARS (set in Cloudflare dashboard + .dev.vars):
//   CLOUDFLARE_ACCESS_AUD    – Application Audience (AUD) tag from Access
//   CLOUDFLARE_ACCESS_TEAM_DOMAIN – e.g. "myteam.cloudflareaccess.com"
//
// CLOUDFLARE DASHBOARD SETUP:
//   1. Zero Trust > Access > Applications > Add Self-Hosted Application
//   2. Application domain: yourdomain.com, path: /admin  (add /api/admin too)
//   3. Identity providers: Google
//   4. Policy: Allow → Emails matching your editors' addresses
//   5. Copy the "Application Audience (AUD) Tag" → CLOUDFLARE_ACCESS_AUD
//   6. Your team domain is shown in Zero Trust > Settings > Custom Pages
//
// WORKERS.DEV BYPASS RISK:
//   By default, Cloudflare Access only protects routes on the configured
//   domain. If the app is also reachable via <name>.workers.dev, attackers
//   can bypass Access. To mitigate:
//     - Disable the workers.dev route in wrangler.jsonc: "workers_dev": false
//     - OR add a second Access application for the workers.dev hostname
//   This middleware provides server-side verification regardless of hostname.
// ---------------------------------------------------------------------------

import type { MiddlewareHandler } from "astro";
import { getAccessUser } from "./lib/auth/cloudflare-access";

/** Paths that require Cloudflare Access authentication. */
function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/")
  );
}

/** True for API routes (JSON responses), false for page routes (redirects). */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/** The login-info page itself must be accessible without auth. */
function isAuthExempt(pathname: string): boolean {
  return pathname === "/admin/login-info" || pathname === "/admin/login-info/";
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = new URL(context.request.url);

  // Public routes and the login-info page pass through
  if (!isProtectedPath(pathname) || isAuthExempt(pathname)) {
    return next();
  }

  const env = (context.locals as any).runtime?.env ?? import.meta.env;
  const aud = env.CLOUDFLARE_ACCESS_AUD;
  const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN;

  // If env vars are missing, fail closed (don't silently allow access)
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

  // Attach verified user to locals for downstream use
  (context.locals as any).editor = user;

  return next();
};
