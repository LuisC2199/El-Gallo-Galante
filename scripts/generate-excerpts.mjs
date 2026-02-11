import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/** @typedef {"Poesía"|"Narrativa"|"Crítica"|"Ensayo"|"Epistolario"} Category */

const POSTS_DIR = path.join(process.cwd(), "src", "content", "posts");

// Tunables
const MAX_POEM_EXCERPT = 160;
const MAX_PROSE_EXCERPT = 220;

// Node 18+ supports Intl.Segmenter
const sentenceSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("es", { granularity: "sentence" })
    : null;

function listMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
      files.push(full);
    }
  }
  return files;
}

function stripMarkdown(md) {
  return md
    // remove code fences
    .replace(/```[\s\S]*?```/g, " ")
    // remove inline code
    .replace(/`[^`]*`/g, " ")
    // remove images ![]()
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    // remove links but keep text [text](url)
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    // remove headings
    .replace(/^#{1,6}\s+/gm, "")
    // remove blockquote markers
    .replace(/^>\s?/gm, "")
    // normalize whitespace
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function firstParagraph(rawBody) {
  const normalized = rawBody.replace(/\r/g, "");
  const parts = normalized.split(/\n\s*\n/); // blank line separator
  return (parts[0] || "").trim();
}

function firstStanza(rawBody) {
  // same as paragraph, but we keep it conceptually "stanza"
  return firstParagraph(rawBody);
}

function toOneLine(text) {
  return text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  const sliced = text.slice(0, maxLen);
  // avoid cutting mid-word
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 60 ? sliced.slice(0, lastSpace) : sliced).trim() + "…";
}

function excerptForPoem(rawBody) {
  const stanza = firstStanza(rawBody);
  const cleaned = toOneLine(stripMarkdown(stanza));
  return truncate(cleaned, MAX_POEM_EXCERPT);
}

function excerptForProse(rawBody) {
  const para = firstParagraph(rawBody);
  const cleaned = toOneLine(stripMarkdown(para));
  if (!cleaned) return "";

  if (!sentenceSegmenter) {
    // fallback: just truncate the paragraph
    return truncate(cleaned, MAX_PROSE_EXCERPT);
  }

  // Take 1–2 sentences
  const segments = Array.from(sentenceSegmenter.segment(cleaned), (s) => s.segment).filter(Boolean);

  let out = "";
  for (const seg of segments) {
    const candidate = (out ? out + " " : "") + seg.trim();
    if (candidate.length > MAX_PROSE_EXCERPT) break;
    out = candidate;
    // stop after 2 sentences
    if (out && out !== "" && out.split(/[.!?¿¡]/).length > 2) break;
    if (segments.indexOf(seg) >= 1) break;
  }

  return truncate(out || cleaned, MAX_PROSE_EXCERPT);
}

function safeCategory(data) {
  const c = data?.category;
  return typeof c === "string" ? c : "";
}

function main() {
  const files = listMarkdownFiles(POSTS_DIR);
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = matter(raw);
    const data = parsed.data || {};
    const body = parsed.content || "";

    // If excerpt already exists and is non-empty, do nothing.
    if (typeof data.excerpt === "string" && data.excerpt.trim().length > 0) {
      skipped += 1;
      continue;
    }

    const category = safeCategory(data);

    if (category === "Poesía") {
      skipped += 1;
      continue;
    }
    const excerpt = excerptForProse(body);

    if (!excerpt) {
      // If we can't generate, skip (don’t write junk)
      skipped += 1;
      continue;
    }

    data.excerpt = excerpt;

    const out = matter.stringify(body, data);
    fs.writeFileSync(file, out, "utf8");
    updated += 1;
  }

  console.log(`✅ Excerpts added to ${updated} post(s). Skipped ${skipped}.`);
}

main();
