import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const AUTHORS_DIR = path.join(process.cwd(), "src", "content", "authors");

function listMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) out.push(full);
  }
  return out;
}

function normalizeBioToMarkdown(bio) {
  // Clean common WP oddities without changing meaning.
  return String(bio)
    .replace(/\u00A0/g, " ") // non-breaking spaces
    .replace(/\r/g, "")
    .trim();
}

function main() {
  const files = listMarkdownFiles(AUTHORS_DIR);
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = matter(raw);

    const data = parsed.data ?? {};
    const existingBody = (parsed.content ?? "").replace(/\r/g, "").trim();

    if (typeof data.bio !== "string" || data.bio.trim().length === 0) {
      skipped += 1;
      continue;
    }

    const bioMd = normalizeBioToMarkdown(data.bio);

    // Remove bio from frontmatter
    delete data.bio;

    // Prepend bio to body if body already exists
    const newBody = existingBody.length > 0
      ? `${bioMd}\n\n${existingBody}\n`
      : `${bioMd}\n`;

    const out = matter.stringify(newBody, data);
    fs.writeFileSync(file, out, "utf8");
    updated += 1;
  }

  console.log(`✅ Updated ${updated} author file(s). Skipped ${skipped}.`);
}

main();