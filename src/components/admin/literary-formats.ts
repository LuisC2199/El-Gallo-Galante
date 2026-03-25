// ---------------------------------------------------------------------------
// Admin – literary formatting definitions for the Milkdown toolbar
// ---------------------------------------------------------------------------
//
// Each format maps to an existing CSS class from global.css.
// The template produces an HTML block that Milkdown stores as an opaque
// `html` node and serializes back to Markdown as-is.
// ---------------------------------------------------------------------------

export interface LiteraryFormat {
  id: string;
  /** Button label shown in toolbar. */
  label: string;
  /** Tooltip text. */
  title: string;
  /** Build the HTML string. Receives selected text or falls back to placeholder. */
  template: (text: string) => string;
  /** Default text when nothing is selected. */
  placeholder: string;
  /** Visual group for toolbar layout. */
  group: "presentacion" | "notas" | "estructura" | "formato";
}

export const LITERARY_FORMATS: LiteraryFormat[] = [
  // ---- Presentación ----
  {
    id: "epigrafe",
    label: "Epígrafe",
    title: "Epígrafe con cita opcional",
    template: (text) =>
      `<blockquote class="epigrafe">\n<p>${text}</p>\n<cite>Autor</cite>\n</blockquote>`,
    placeholder: "Texto del epígrafe",
    group: "presentacion",
  },
  {
    id: "dedicatoria",
    label: "Dedicatoria",
    title: "Dedicatoria centrada en cursiva",
    template: (text) => `<p class="dedicatoria">${text}</p>`,
    placeholder: "Para…",
    group: "presentacion",
  },
  {
    id: "meta-epistolar",
    label: "Meta",
    title: "Metadato epistolar (lugar, fecha)",
    template: (text) => `<p class="epistolary-meta">${text}</p>`,
    placeholder: "Ciudad, fecha",
    group: "presentacion",
  },

  // ---- Notas ----
  {
    id: "nota-editorial",
    label: "Nota",
    title: "Nota editorial destacada",
    template: (text) =>
      `<div class="editorial-note">\n\n${text}\n\n</div>`,
    placeholder: "Nota del editor…",
    group: "notas",
  },
  {
    id: "nota-al-pie",
    label: "Nota al pie",
    title: "Nota al pie de página",
    template: (text) => `<p class="footnote">${text}</p>`,
    placeholder: "Referencia o nota al pie…",
    group: "notas",
  },

  // ---- Estructura ----
  {
    id: "separador",
    label: "Separador",
    title: "Separador de sección",
    template: () => `<hr class="section-divider" />`,
    placeholder: "",
    group: "estructura",
  },
  {
    id: "caption",
    label: "Pie de imagen",
    title: "Pie de imagen o fotografía",
    template: (text) => `<span class="caption">${text}</span>`,
    placeholder: "Descripción de la imagen…",
    group: "estructura",
  },
  {
    id: "firma",
    label: "Firma",
    title: "Firma o rúbrica (alineada a la derecha)",
    template: (text) => `<p class="poem-signature">${text}</p>`,
    placeholder: "Lugar, fecha",
    group: "estructura",
  },

  // ---- Formato ----
  {
    id: "poesia",
    label: "Poesía",
    title: "Bloque de poesía (preserva saltos de línea)",
    template: (text) =>
      `<div class="poetry" style="white-space:pre-line">\n\n${text}\n\n</div>`,
    placeholder: "Verso 1\nVerso 2\nVerso 3",
    group: "formato",
  },
  {
    id: "capitular",
    label: "Capitular",
    title: "Letra capitular decorativa",
    template: (text) =>
      `<span class="dropcap">${(text || "L").charAt(0)}</span>`,
    placeholder: "L",
    group: "formato",
  },
];
