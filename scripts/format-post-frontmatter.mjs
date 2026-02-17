import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "src", "content", "posts");
const IMAGE_DIR = path.join(process.cwd(), "public", "posts");
const DEFAULT_IMAGE_EXT = "jpg";

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

function slugFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function mapCategorySlugToLabel(slug) {
  const s = String(slug || "").toLowerCase().trim();
  if (s === "poesia" || s === "poesía") return "Poesía";
  if (s === "narrativa") return "Narrativa";
  if (s === "critica" || s === "crítica") return "Crítica";
  if (s === "ensayo") return "Ensayo";
  if (s === "epistolario") return "Epistolario";
  return "";
}

function deriveIssueAndCategory(wpCategories) {
  const cats = Array.isArray(wpCategories) ? wpCategories.map(String) : [];
  const issue = cats.find((c) => c.toLowerCase().startsWith("ano-")) || "";

  let category = "";
  for (const c of cats) {
    const label = mapCategorySlugToLabel(c);
    if (label) {
      category = label;
      break;
    }
  }
  return { issue, category };
}

function cleanBody(rawBody) {
  let body = String(rawBody ?? "");
  body = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  body = body.replace(/\u00A0/g, " ").replace(/&nbsp;/g, " ");
  body = body.replace(/<\s*em\s*>/gi, "*").replace(/<\s*\/\s*em\s*>/gi, "*");
  body = body.replace(/<\s*i\s*>/gi, "*").replace(/<\s*\/\s*i\s*>/gi, "*");

  // safe _italics_ -> *italics*
  body = body.replace(
    /(^|[\s([{"'“‘¡¿])_([^_\n][^_\n]*?)_([\s)\]}"'”’.,;:!?¡¿]|$)/g,
    (_m, p1, inner, p3) => `${p1}*${inner}*${p3}`
  );

  return body;
}

function detectImagePath(slug) {
  const exts = ["jpg", "jpg", "png", "webp"];
  for (const ext of exts) {
    const full = path.join(IMAGE_DIR, `${slug}.${ext}`);
    if (fs.existsSync(full)) return `/posts/${slug}.${ext}`;
  }
  return `/posts/${slug}.${DEFAULT_IMAGE_EXT}`;
}

function main() {
  const files = listMarkdownFiles(POSTS_DIR);
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = matter(raw);
    const data = parsed.data ?? {};
    const body = parsed.content ?? "";

    const slug = slugFromFile(file);

    const title = typeof data.title === "string" ? data.title.trim() : "";
    const date = data.date;
    const author = typeof data.author === "string" ? data.author.trim() : "";

    const { issue, category } = deriveIssueAndCategory(data.categories);

    // Translator slug (optional)
    const traductor =
      typeof data.traductor === "string" && data.traductor.trim().length > 0
        ? data.traductor.trim()
        : undefined;

    if (!title || !date || !author) {
      console.warn(`⚠️ Skipping (missing title/date/author): ${path.relative(process.cwd(), file)}`);
      skipped += 1;
      continue;
    }
    if (!category) {
      console.warn(`⚠️ Skipping (could not derive category): ${path.relative(process.cwd(), file)}`);
      skipped += 1;
      continue;
    }
    if (!issue) {
      console.warn(`⚠️ Skipping (could not derive issue): ${path.relative(process.cwd(), file)}`);
      skipped += 1;
      continue;
    }

    const imgPath = detectImagePath(slug);

    const newData = {
      title,
      date,
      category,
      issue,
      author, // reference("authors")
      ...(traductor ? { traductor } : {}), // reference("authors").optional()
      coverImage: imgPath,
      featuredImage: imgPath,
    };

    const cleaned = cleanBody(body);
    const out = matter.stringify(cleaned, newData);
    fs.writeFileSync(file, out, "utf8");
    updated += 1;
  }

  console.log(`✅ Updated ${updated} post file(s). Skipped ${skipped}.`);
}

main();