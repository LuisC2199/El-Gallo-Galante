import { parseDocument } from "yaml";

export interface ParsedMarkdown {
  data: Record<string, unknown>;
  content: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseMarkdown(raw: string): ParsedMarkdown {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { data: {}, content: raw };

  const doc = parseDocument(match[1], { prettyErrors: false });
  if (doc.errors.length > 0) throw doc.errors[0];

  const parsed = doc.toJSON();
  const data =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  return {
    data,
    content: raw.slice(match[0].length),
  };
}
