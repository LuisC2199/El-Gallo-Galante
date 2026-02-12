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
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function getSlugFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function main() {
  const files = listMarkdownFiles(AUTHORS_DIR);
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = matter(raw);

    const data = parsed.data ?? {};
    const body = parsed.content ?? "";

    const slug = getSlugFromFile(file);

    let changed = false;

    // photo
    if (typeof data.photo !== "string" || data.photo.trim().length === 0) {
      data.photo = `/authors/${slug}.jpg`;
      changed = true;
    }

    // social
    const defaultSocial = {
      website: "",
      instagram: "",
      x: "",
      facebook: "",
      tiktok: "",
    };

    if (!data.social || typeof data.social !== "object") {
      data.social = { ...defaultSocial };
      changed = true;
    } else {
      // Ensure each key exists without overwriting existing values
      for (const key of Object.keys(defaultSocial)) {
        if (!(key in data.social)) {
          data.social[key] = "";
          changed = true;
        }
      }
    }

    if (!changed) {
      skipped += 1;
      continue;
    }

    const out = matter.stringify(body, data);
    fs.writeFileSync(file, out, "utf8");
    updated += 1;
  }

  console.log(`✅ Updated ${updated} author file(s). Skipped ${skipped}.`);
}

main();