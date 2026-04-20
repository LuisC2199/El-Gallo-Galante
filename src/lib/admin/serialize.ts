// ---------------------------------------------------------------------------
// Serialize frontmatter + body back into a Markdown file with YAML front matter
// ---------------------------------------------------------------------------

/**
 * Preferred key ordering per collection type.
 * Keys present in the list appear first in order; any remaining keys
 * are appended alphabetically afterwards.
 */
const POST_KEY_ORDER = [
  "title",
  "date",
  "category",
  "status",
  "issue",
  "author",
  "traductor",
  "excerpt",
  "presentacion",
  "coverImage",
  "featuredImage",
  "imagePosition",
];

const AUTHOR_KEY_ORDER = [
  "name",
  "birthYear",
  "birthPlace",
  "photo",
  "gender",
  "social",
];

const ISSUE_KEY_ORDER = [
  "title",
  "date",
  "endDate",
  "number",
  "coverImage",
  "description",
  "featuredPostSlugs",
];

/**
 * Convert a frontmatter value to a YAML-safe string representation.
 * Handles the subset of types we actually encounter in post frontmatter.
 */
function yamlValue(value: unknown, indent = 0): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    // Dates that look like ISO strings: keep unquoted
    if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(value)) {
      return value;
    }
    // Strings that need quoting: contain colons, leading/trailing spaces,
    // special YAML chars, or look like numbers/booleans
    if (
      /[:#{}[\],&*?|>!%@`]/.test(value) ||
      /^[\s]|[\s]$/.test(value) ||
      /^(true|false|yes|no|null|~)$/i.test(value) ||
      /^-?\d+(\.\d+)?$/.test(value) ||
      value === ""
    ) {
      return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const prefix = " ".repeat(indent);
    return "\n" + value.map((v) => `${prefix}  - ${yamlValue(v, indent + 2)}`).join("\n");
  }

  if (typeof value === "object") {
    const prefix = " ".repeat(indent);
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    );
    if (entries.length === 0) return "{}";
    return (
      "\n" +
      entries
        .map(([k, v]) => `${prefix}  ${k}: ${yamlValue(v, indent + 2)}`)
        .join("\n")
    );
  }

  return String(value);
}

/**
 * Generic serializer: frontmatter + body → Markdown string with YAML
 * front matter, using the given key ordering.
 */
function serializeMarkdown(
  frontmatter: Record<string, unknown>,
  body: string,
  keyOrder: string[],
): string {
  // ---- Build ordered key list ----
  const present = new Set(Object.keys(frontmatter));
  const ordered: string[] = [];

  for (const key of keyOrder) {
    if (present.has(key)) {
      ordered.push(key);
      present.delete(key);
    }
  }
  // Append remaining keys alphabetically
  for (const key of [...present].sort()) {
    ordered.push(key);
  }

  // ---- Render YAML lines ----
  const lines: string[] = [];
  for (const key of ordered) {
    const val = frontmatter[key];
    if (val === undefined || val === null || val === "") continue;
    lines.push(`${key}: ${yamlValue(val)}`);
  }

  const yaml = lines.join("\n");
  const trimmedBody = body.replace(/^\n+/, "");
  return `---\n${yaml}\n---\n\n${trimmedBody}${trimmedBody.endsWith("\n") ? "" : "\n"}`;
}

/**
 * Serialize a post frontmatter + body into a complete Markdown file.
 */
export function serializePost(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  return serializeMarkdown(frontmatter, body, POST_KEY_ORDER);
}

/**
 * Serialize an author frontmatter + body into a complete Markdown file.
 */
export function serializeAuthor(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  return serializeMarkdown(frontmatter, body, AUTHOR_KEY_ORDER);
}

/**
 * Serialize an issue frontmatter + body into a complete Markdown file.
 */
export function serializeIssue(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  return serializeMarkdown(frontmatter, body, ISSUE_KEY_ORDER);
}

/**
 * Serialize the preamble (singleton) frontmatter + body into a complete Markdown file.
 */
export function serializePreamble(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  return serializeMarkdown(frontmatter, body, ["title"]);
}
