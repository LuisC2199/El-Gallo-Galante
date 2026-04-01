// ---------------------------------------------------------------------------
// Cloudflare Access JWT verification & editor identity helpers
// ---------------------------------------------------------------------------
// Verifies the Cf-Access-Jwt-Assertion token using Cloudflare's public JWKS.
// Works in Cloudflare Workers runtime (uses Web Crypto / jose).
// ---------------------------------------------------------------------------

import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload } from "jose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccessUser {
  email: string;
  name: string;
  sub: string;
  aud: string | string[];
  iss: string;
}

interface AccessEnv {
  CLOUDFLARE_ACCESS_AUD?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
}

// ---------------------------------------------------------------------------
// JWKS cache — one per team domain, lives for the Worker lifetime
// ---------------------------------------------------------------------------

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    const url = new URL(`https://${teamDomain}/cdn-cgi/access/certs`);
    jwks = createRemoteJWKSet(url);
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

// ---------------------------------------------------------------------------
// Core verification
// ---------------------------------------------------------------------------

/**
 * Extracts and cryptographically verifies the Cloudflare Access JWT.
 * Returns a normalized `AccessUser` on success, or `null` if the token
 * is missing, invalid, or env vars are not configured.
 */
export async function getAccessUser(
  request: Request,
  env: AccessEnv,
): Promise<AccessUser | null> {
  const aud = env.CLOUDFLARE_ACCESS_AUD;
  const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN;

  // If env vars aren't set, we can't verify — fail closed
  if (!aud || !teamDomain) return null;

  // Token can come from header or cookie
  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ??
    getCookie(request, "CF_Authorization");

  if (!token) return null;

  try {
    const jwks = getJWKS(teamDomain);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${teamDomain}`,
      audience: aud,
    });

    const email = claimString(payload, "email");
    if (!email) return null;

    return {
      email,
      name: claimString(payload, "name") ?? email.split("@")[0],
      sub: payload.sub ?? "",
      aud: payload.aud ?? "",
      iss: payload.iss ?? "",
    };
  } catch {
    // Signature invalid, expired, wrong audience, etc.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware-oriented helper
// ---------------------------------------------------------------------------

/**
 * Returns the verified editor or `null`. Uses the Astro APIContext's
 * `locals.runtime.env` (Cloudflare) or `import.meta.env` (dev).
 */
export async function getEditor(
  context: { request: Request; locals: Record<string, any> },
): Promise<AccessUser | null> {
  const env = context.locals.runtime?.env ?? import.meta.env;
  return getAccessUser(context.request, env);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function claimString(payload: JWTPayload, key: string): string | undefined {
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}
