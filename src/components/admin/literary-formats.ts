// ---------------------------------------------------------------------------
// Admin – literary formatting definitions for the Milkdown toolbar
// ---------------------------------------------------------------------------
//
// Each format maps to an existing CSS class from global.css.
// The template produces an HTML block that Milkdown stores as an inline
// atom `html` node (attrs.value) and serializes back to Markdown as-is.
//
// Formats also carry extraction helpers so the editing modal can parse
// field values back out of existing HTML blocks.
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export interface EditableField {
  key: string;
  label: string;
  type: "text" | "textarea";
  default: string;
}

export type LiteraryGroupId =
  | "presentacion"
  | "notas"
  | "estructura"
  | "formato";

export interface LiteraryGroup {
  id: LiteraryGroupId;
  label: string;
  icon: string;
}

export interface LiteraryFormat {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** CSS class used in the HTML output — also used for detection. */
  cssClass: string;
  group: LiteraryGroupId;
  /** Editable fields shown in the editing modal. Empty → insert directly. */
  fields: EditableField[];
  /** Build the HTML string from field values. */
  template: (values: Record<string, string>) => string;
  /** Extract field values from an existing HTML string. */
  extract: (html: string) => Record<string, string>;
}

// ---- Group definitions ----------------------------------------------------

export const LITERARY_GROUPS: LiteraryGroup[] = [
  { id: "presentacion", label: "Presentación", icon: "❧" },
  { id: "notas", label: "Notas", icon: "†" },
  { id: "estructura", label: "Estructura", icon: "§" },
  { id: "formato", label: "Formato", icon: "¶" },
];

// ---- Format definitions ---------------------------------------------------

export const LITERARY_FORMATS: LiteraryFormat[] = [
  // ---- Presentación ----
  {
    id: "epigrafe",
    label: "Epígrafe",
    description: "Cita con atribución",
    icon: "«",
    cssClass: "epigrafe",
    group: "presentacion",
    fields: [
      { key: "text", label: "Cita", type: "textarea", default: "Texto del epígrafe" },
      { key: "author", label: "Autor", type: "text", default: "Autor" },
    ],
    template: ({ text, author }) =>
      `<blockquote class="epigrafe">\n<p>${text}</p>\n<cite>${author}</cite>\n</blockquote>`,
    extract: (html) => ({
      text: html.match(/<p>([\s\S]*?)<\/p>/)?.[1]?.trim() ?? "",
      author: html.match(/<cite>([\s\S]*?)<\/cite>/)?.[1]?.trim() ?? "",
    }),
  },
  {
    id: "dedicatoria",
    label: "Dedicatoria",
    description: "Centrada en cursiva",
    icon: "✦",
    cssClass: "dedicatoria",
    group: "presentacion",
    fields: [
      { key: "text", label: "Dedicatoria", type: "text", default: "Para…" },
    ],
    template: ({ text }) => `<p class="dedicatoria">${text}</p>`,
    extract: (html) => ({
      text: html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]?.trim() ?? "",
    }),
  },
  {
    id: "meta-epistolar",
    label: "Meta",
    description: "Lugar o fecha (alineado a la derecha)",
    icon: "◇",
    cssClass: "epistolary-meta",
    group: "presentacion",
    fields: [
      { key: "text", label: "Texto", type: "text", default: "Ciudad, fecha" },
    ],
    template: ({ text }) => `<p class="epistolary-meta">${text}</p>`,
    extract: (html) => ({
      text: html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]?.trim() ?? "",
    }),
  },

  // ---- Notas ----
  {
    id: "nota-editorial",
    label: "Nota",
    description: "Nota editorial destacada",
    icon: "✎",
    cssClass: "editorial-note",
    group: "notas",
    fields: [
      { key: "text", label: "Nota", type: "textarea", default: "Nota del editor…" },
    ],
    template: ({ text }) =>
      `<div class="editorial-note">\n\n${text}\n\n</div>`,
    extract: (html) => ({
      text: html.match(/<div[^>]*>([\s\S]*?)<\/div>/)?.[1]?.trim() ?? "",
    }),
  },
  {
    id: "nota-al-pie",
    label: "Nota al pie",
    description: "Referencia al pie de página",
    icon: "⁑",
    cssClass: "footnote",
    group: "notas",
    fields: [
      { key: "text", label: "Texto", type: "textarea", default: "Referencia o nota al pie…" },
    ],
    template: ({ text }) => `<p class="footnote">${text}</p>`,
    extract: (html) => ({
      text: html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]?.trim() ?? "",
    }),
  },

  // ---- Estructura ----
  {
    id: "separador",
    label: "Separador",
    description: "Separador de sección",
    icon: "—",
    cssClass: "section-divider",
    group: "estructura",
    fields: [],
    template: () => `<hr class="section-divider" />`,
    extract: () => ({}),
  },
  {
    id: "caption",
    label: "Pie de imagen",
    description: "Descripción de imagen o foto",
    icon: "▭",
    cssClass: "caption",
    group: "estructura",
    fields: [
      { key: "text", label: "Texto", type: "text", default: "Descripción de la imagen…" },
    ],
    template: ({ text }) => `<span class="caption">${text}</span>`,
    extract: (html) => ({
      text: html.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1]?.trim() ?? "",
    }),
  },
  {
    id: "firma",
    label: "Firma",
    description: "Rúbrica alineada a la derecha",
    icon: "✍",
    cssClass: "poem-signature",
    group: "estructura",
    fields: [
      { key: "text", label: "Firma", type: "text", default: "Lugar, fecha" },
    ],
    template: ({ text }) => `<p class="poem-signature">${text}</p>`,
    extract: (html) => ({
      text: html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]?.trim() ?? "",
    }),
  },

  // ---- Formato ----
  {
    id: "poesia",
    label: "Poesía",
    description: "Preserva saltos de línea",
    icon: "♦",
    cssClass: "poetry",
    group: "formato",
    fields: [
      { key: "text", label: "Versos", type: "textarea", default: "Verso 1\nVerso 2\nVerso 3" },
    ],
    template: ({ text }) =>
      `<div class="poetry" style="white-space:pre-line">\n\n${text}\n\n</div>`,
    extract: (html) => ({
      text: html.match(/<div[^>]*>([\s\S]*?)<\/div>/)?.[1]?.trim() ?? "",
    }),
  },
  {
    id: "capitular",
    label: "Capitular",
    description: "Letra capital decorativa",
    icon: "A",
    cssClass: "dropcap",
    group: "formato",
    fields: [
      { key: "text", label: "Letra", type: "text", default: "L" },
    ],
    template: ({ text }) =>
      `<span class="dropcap">${(text || "L").charAt(0)}</span>`,
    extract: (html) => ({
      text: html.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1]?.charAt(0) ?? "L",
    }),
  },
];

// ---- Utilities ------------------------------------------------------------

/** Detect which literary format an HTML string belongs to. */
export function detectLiteraryFormat(html: string): LiteraryFormat | null {
  for (const format of LITERARY_FORMATS) {
    if (
      html.includes(`class="${format.cssClass}"`) ||
      html.includes(`class="${format.cssClass} `)
    ) {
      return format;
    }
  }
  return null;
}

/** Return format definitions grouped by their group. */
export function getGroupedFormats(): {
  group: LiteraryGroup;
  formats: LiteraryFormat[];
}[] {
  return LITERARY_GROUPS.map((g) => ({
    group: g,
    formats: LITERARY_FORMATS.filter((f) => f.group === g.id),
  }));
}
