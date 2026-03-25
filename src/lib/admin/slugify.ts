// ---------------------------------------------------------------------------
// Admin – shared slug generation
// ---------------------------------------------------------------------------

/**
 * Generate a URL/filename-safe slug from arbitrary text.
 *
 * - Normalizes Unicode (NFD) and strips combining diacritics
 * - Lowercases, replaces non-alphanumeric runs with a single dash
 * - Trims leading/trailing dashes
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")    // non-alnum → dash
    .replace(/^-+|-+$/g, "");       // trim dashes
}

/**
 * Given a desired slug and a set of existing slugs, return a unique variant.
 *
 * If `slug` is not taken, returns it as-is.
 * Otherwise appends `-2`, `-3`, etc. until a free one is found.
 */
export function uniqueSlug(slug: string, existing: Set<string>): string {
  if (!existing.has(slug)) return slug;
  let n = 2;
  while (existing.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}
