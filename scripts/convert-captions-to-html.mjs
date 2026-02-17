import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src", "content", "posts");

const CAPTION_PREFIXES = [
  "Fotografía",
  "Fotografia",
  "Foto",
  "Imagen",
  "Ilustración",
  "Ilustracion",
  "Crédito",
  "Credito",
  "Fuente",
];

const IMG_RE = /^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

const CAPTION_RE = new RegExp(
  `^\\s*(?:${CAPTION_PREFIXES.join("|")})\\b`,
  "i"
);

function convertMarkdownLinksToHTML(text) {
  return text.replace(MD_LINK_RE, (_, label, url) => {
    return `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
  });
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (full.endsWith(".md") || full.endsWith(".mdx")) {
      files.push(full);
    }
  }

  return files;
}

async function main() {
  const files = await walk(ROOT);
  let changed = 0;

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const lines = content.split("\n");

    let modified = false;

    for (let i = 0; i < lines.length - 1; i++) {
      if (IMG_RE.test(lines[i])) {
        let j = i + 1;
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;

        if (CAPTION_RE.test(lines[j])) {
          const newCaption = convertMarkdownLinksToHTML(lines[j]);
          lines[j] = `<span class="caption">${newCaption}</span>`;
          modified = true;
        }
      }
    }

    if (modified) {
      await fs.writeFile(file + ".bak", content);
      await fs.writeFile(file, lines.join("\n"));
      console.log("Updated:", path.basename(file));
      changed++;
    }
  }

  console.log("Done. Files updated:", changed);
}

main();
