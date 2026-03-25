// ---------------------------------------------------------------------------
// Admin – Post preview panel (iframe-based, mirrors production rendering)
// ---------------------------------------------------------------------------
import { useMemo } from "react";
import { marked } from "marked";
import type { AuthorSummary } from "../../lib/admin/types";

interface PostPreviewPanelProps {
  frontmatter: Record<string, unknown>;
  body: string;
  authors: AuthorSummary[];
}

// ---------------------------------------------------------------------------
// CSS: Tailwind utility subset used by the production post template,
// plus all custom classes from global.css relevant to post rendering.
// This avoids needing a CDN script — the iframe runs with no JS at all.
// ---------------------------------------------------------------------------

const PREVIEW_CSS = /* css */ `
/* ---- Reset ---- */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
img, video { max-width: 100%; display: block; }

/* ---- Base ---- */
body {
  font-family: 'Inter', sans-serif;
  background-color: #fcfcfc;
  color: #1a1a1a;
}
.serif { font-family: 'Crimson Pro', serif; }
.display-serif { font-family: 'Playfair Display', serif; }
::selection { background: #e5e7eb; }

/* ---- Tailwind utility subset (only what the post template uses) ---- */
.min-h-screen { min-height: 100vh; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-grow { flex-grow: 1; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.gap-4 { gap: 1rem; }
.gap-6 { gap: 1.5rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
.pt-12 { padding-top: 3rem; }
.pb-20 { padding-bottom: 5rem; }
.mb-12 { margin-bottom: 3rem; }
.mb-16 { margin-bottom: 4rem; }
.w-full { width: 100%; }
.w-1 { width: 0.25rem; }
.h-1 { height: 0.25rem; }
.max-w-screen-xl { max-width: 1280px; }
.max-w-3xl { max-width: 48rem; }
.max-w-2xl { max-width: 42rem; }
.text-center { text-align: center; }
.text-justify { text-align: justify; }
.text-right { text-align: right; }
.text-\\[10px\\] { font-size: 10px; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-base { font-size: 1rem; line-height: 1.5rem; }
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
.text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
.font-bold { font-weight: 700; }
.font-medium { font-weight: 500; }
.font-light { font-weight: 300; }
.uppercase { text-transform: uppercase; }
.italic { font-style: italic; }
.leading-tight { line-height: 1.25; }
.leading-snug { line-height: 1.375; }
.leading-relaxed { line-height: 1.625; }
.tracking-\\[0\\.3em\\] { letter-spacing: 0.3em; }
.antialiased { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
.text-stone-400 { color: #a8a29e; }
.text-stone-800 { color: #292524; }
.bg-stone-100 { background-color: #f5f5f4; }
.bg-stone-300 { background-color: #d6d3d1; }
.rounded-full { border-radius: 9999px; }
.object-cover { object-fit: cover; }
.object-top { object-position: top; }
.object-bottom { object-position: bottom; }
.whitespace-pre-line { white-space: pre-line; }
.overflow-x-auto { overflow-x: auto; }
.space-y-8 > * + * { margin-top: 2rem; }
.selection\\:bg-stone-200 *::selection,
.selection\\:bg-stone-200::selection { background-color: #e7e5e4; }
.h-\\[50vh\\] { height: 50vh; }

@media (min-width: 640px) {
  .sm\\:text-lg { font-size: 1.125rem; line-height: 1.75rem; }
}
@media (min-width: 768px) {
  .md\\:text-xl { font-size: 1.25rem; line-height: 1.75rem; }
  .md\\:text-2xl { font-size: 1.5rem; line-height: 2rem; }
  .md\\:text-7xl { font-size: 4.5rem; line-height: 1; }
  .md\\:mb-24 { margin-bottom: 6rem; }
  .md\\:h-\\[70vh\\] { height: 70vh; }
}

/* ---- Drop cap ---- */
.drop-cap > p:first-child::first-letter,
.drop-cap::first-letter {
  float: left;
  font-family: "Playfair Display", serif;
  font-size: 3.5em;
  line-height: 0.9;
  padding-right: 0.12em;
  padding-top: 0.05em;
}

/* Manual drop cap via <span class="dropcap"> */
.dropcap {
  float: left;
  font-family: "Playfair Display", serif;
  font-size: 3.5em;
  line-height: 0.9;
  padding-right: 0.12em;
  padding-top: 0.05em;
}

/* ---- Poetry ---- */
.poetry p { margin: 0; }
.poetry p + p { margin-top: 1.25rem; }

/* ---- Entry content ---- */
.entry-content figure { margin: 2.5rem 0; }
.entry-content figure img { width: 100%; display: block; border-radius: 0.25rem; }
.entry-content figcaption {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  font-family: 'Crimson Pro', serif;
  font-style: italic;
  color: #78716c;
  line-height: 1.45;
  text-align: center;
  opacity: 0.9;
}
.entry-content figcaption::before { content: "— "; opacity: 0.5; }
.entry-content .image-block.align-center { text-align: center; }
.entry-content .image-block.align-left { text-align: left; }
.entry-content .image-block.align-left figcaption { text-align: left; }
.entry-content .image-block.align-right { text-align: right; }
.entry-content .image-block.align-right img { margin-left: auto; }
.entry-content .image-block.align-right figcaption { text-align: right; }
.entry-content .text-justify { text-align: justify; }
.entry-content .text-right { text-align: right; }
.entry-content .signature { text-align: right; font-style: italic; }
.entry-content .epistolary-meta { text-align: right; opacity: 0.8; }

/* ---- Presentación elements ---- */
.meta-epistolar {
  font-family: 'Crimson Pro', serif;
  font-style: italic;
  text-align: right;
  color: #78716c;
  font-size: 1rem;
  opacity: 0.8;
  margin-bottom: 2rem;
}
.dedicatoria {
  font-family: 'Crimson Pro', serif;
  font-style: italic;
  text-align: center;
  color: #57534e;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}
.epigrafe {
  font-family: 'Crimson Pro', serif;
  font-style: italic;
  color: #78716c;
  border-left: 2px solid #d6d3d1;
  padding-left: 1.5rem;
  margin: 0 0 3rem 0;
  max-width: 24rem;
}
.epigrafe p { font-size: 1rem; line-height: 1.6; margin: 0; }
.epigrafe cite {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  font-style: normal;
  opacity: 0.8;
}
.epigrafe cite::before { content: "— "; }

.poem-signature {
  margin-top: 3rem;
  font-family: 'Crimson Pro', serif;
  font-style: italic;
  font-size: 0.95rem;
  color: #78716c;
  text-align: right;
  opacity: 0.85;
}

/* ---- Other editorial elements ---- */
.caption {
  display: block;
  margin-top: 0.75rem;
  font-family: 'Crimson Pro', serif;
  font-style: italic;
  font-size: 0.9rem;
  color: #78716c;
  text-align: center;
  line-height: 1.4;
}
.caption a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: rgba(120, 113, 108, 0.4);
}
.caption a:hover { color: #1c1917; }

.footnote {
  font-size: 0.9rem;
  color: #666;
  border-top: 1px solid #e5e5e5;
  padding-top: 0.8rem;
  margin-top: 3rem;
  line-height: 1.5;
}
.footnote a { color: inherit; text-decoration: underline; }

.footnotes {
  font-size: 0.9rem;
  color: #666;
  margin-top: 4rem;
  line-height: 1.6;
  border-top: 1px solid #e5e5e5;
  padding-top: 2rem;
}
.footnotes p { margin-bottom: 1rem; }

.section-divider {
  margin: 4rem 0;
  border: none;
  border-top: 1px solid #e5e5e5;
}

.editorial-note {
  font-size: 0.8rem;
  color: #555;
  background: #f7f7f7;
  padding: 1rem;
  margin: 3rem 0;
  border-left: 3px solid #ccc;
  line-height: 1.6;
}

.non-italic { font-style: normal; }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: unknown): string {
  if (!value) return "";
  try {
    return new Date(String(value)).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PostPreviewPanel({
  frontmatter,
  body,
  authors,
}: PostPreviewPanelProps) {
  const html = useMemo(() => {
    try {
    const fm = frontmatter;
    const title = String(fm.title ?? "Untitled");
    const category = String(fm.category ?? "");
    const date = formatDate(fm.date);
    const featuredImage = String(fm.featuredImage ?? "");
    const imagePosition = String(fm.imagePosition ?? "");
    const isPoetry = category === "Poesía";

    // Resolve author name from slug
    const authorSlug = String(fm.author ?? "");
    const author = authors.find((a) => a.slug === authorSlug);
    const authorName = author?.name ?? authorSlug;

    // Presentación (nested frontmatter object)
    const pres = (fm.presentacion ?? {}) as Record<string, unknown>;
    const metaEpistolar = String(pres.metaEpistolar ?? "");
    const dedicatoria = String(pres.dedicatoria ?? "");
    const epigrafe = String(pres.epigrafe ?? "");
    const epigrafeAutor = String(pres.epigrafeAutor ?? "");
    const firma = String(pres.firma ?? "");
    const dropCapMode = String(pres.dropCapMode ?? "auto");

    // Convert markdown body → HTML
    let bodyHtml: string;
    try {
      bodyHtml = marked.parse(body, { async: false }) as string;
    } catch {
      bodyHtml = `<p style="color:red">Error rendering Markdown body.</p><pre>${escapeHtml(body)}</pre>`;
    }

    // Build entry-content class list (mirrors [slug].astro)
    const bodyClasses = [
      "entry-content serif text-stone-800",
      dropCapMode === "auto" && "drop-cap",
      // "manual" mode: no auto drop-cap class — relies on <span class="dropcap"> in body
      // "none" mode: no drop-cap styling at all
      isPoetry
        ? "text-base sm:text-lg md:text-xl leading-snug whitespace-pre-line overflow-x-auto poetry"
        : "text-xl md:text-2xl leading-relaxed space-y-8 text-justify",
    ]
      .filter(Boolean)
      .join(" ");

    const imgPosClass =
      imagePosition === "top"
        ? "object-top"
        : imagePosition === "bottom"
          ? "object-bottom"
          : "";

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Inter:wght@300;400;600&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
  <style>${PREVIEW_CSS}</style>
</head>
<body class="min-h-screen antialiased">
  <div class="min-h-screen flex flex-col selection:bg-stone-200">
    <main class="flex-grow pt-12 pb-20">
      <article class="max-w-screen-xl mx-auto px-6">

        <header class="max-w-3xl mx-auto mb-16 md:mb-24 text-center">
          <div class="flex flex-col items-center gap-6 mb-12">
            ${category ? `<span class="text-[10px] tracking-[0.3em] uppercase font-bold text-stone-800 bg-stone-100 px-4 py-1">${escapeHtml(category)}</span>` : ""}
            <h1 class="display-serif text-4xl md:text-7xl font-bold leading-tight">${escapeHtml(title)}</h1>
            <div class="flex items-center gap-4 text-sm text-stone-400 font-light">
              ${authorName ? `<span>${escapeHtml(authorName)}</span>` : ""}
              ${authorName && date ? '<span class="w-1 h-1 bg-stone-300 rounded-full"></span>' : ""}
              ${date ? `<span>${escapeHtml(date)}</span>` : ""}
            </div>
          </div>
          ${
            featuredImage
              ? `<div class="w-full mb-16 md:mb-24">
              <img src="${escapeHtml(featuredImage)}" alt="${escapeHtml(title)}" class="w-full h-[50vh] md:h-[70vh] object-cover ${imgPosClass}" />
            </div>`
              : ""
          }
        </header>

        <div class="max-w-2xl mx-auto">
          ${metaEpistolar ? `<p class="meta-epistolar">${escapeHtml(metaEpistolar)}</p>` : ""}
          ${dedicatoria ? `<p class="dedicatoria">${escapeHtml(dedicatoria)}</p>` : ""}
          ${
            epigrafe
              ? `<blockquote class="epigrafe">
              <p>${escapeHtml(epigrafe)}</p>
              ${epigrafeAutor ? `<cite>${escapeHtml(epigrafeAutor)}</cite>` : ""}
            </blockquote>`
              : ""
          }

          <div class="${bodyClasses}">
            ${bodyHtml}
          </div>

          ${firma ? `<p class="poem-signature">${escapeHtml(firma)}</p>` : ""}
        </div>

      </article>
    </main>
  </div>
</body>
</html>`;
    } catch {
      return `<html><body><p style="color:red">Error generating preview.</p></body></html>`;
    }
  }, [frontmatter, body, authors]);

  return (
    <iframe
      srcDoc={html}
      className="flex-1 w-full border-0 bg-white"
      sandbox="allow-same-origin"
      title="Post preview"
    />
  );
}
