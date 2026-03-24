// =============================================================================
// Decap CMS — Custom Editor Components for El Gallo Galante
// =============================================================================
// These editor components add toolbar buttons to the Markdown widget so that
// editors can insert preformatted HTML blocks without writing raw HTML.
//
// Loaded from /public/admin/index.html after decap-cms.js.
// =============================================================================

CMS.registerEditorComponent({
  id: "parrafo-justificado",
  label: "Párrafo justificado",
  fields: [
    {
      name: "text",
      label: "Texto",
      widget: "string",
      default: "Texto aquí...",
    },
  ],
  pattern: /^<p class="text-justify">(.*?)<\/p>$/ms,
  fromBlock: function (match) {
    return { text: match[1] };
  },
  toBlock: function (data) {
    return '<p class="text-justify">' + (data.text || "Texto aquí...") + "</p>";
  },
  toPreview: function (data) {
    return '<p style="text-align:justify">' + (data.text || "") + "</p>";
  },
});

CMS.registerEditorComponent({
  id: "texto-derecha",
  label: "Texto a la derecha",
  fields: [
    {
      name: "text",
      label: "Texto",
      widget: "string",
      default: "Texto aquí...",
    },
  ],
  pattern: /^<p class="text-right">(.*?)<\/p>$/ms,
  fromBlock: function (match) {
    return { text: match[1] };
  },
  toBlock: function (data) {
    return '<p class="text-right">' + (data.text || "Texto aquí...") + "</p>";
  },
  toPreview: function (data) {
    return '<p style="text-align:right">' + (data.text || "") + "</p>";
  },
});

CMS.registerEditorComponent({
  id: "firma",
  label: "Firma",
  fields: [
    {
      name: "name",
      label: "Nombre",
      widget: "string",
      default: "Nombre del autor",
    },
  ],
  pattern: /^<p class="signature">(.*?)<\/p>$/ms,
  fromBlock: function (match) {
    return { name: match[1] };
  },
  toBlock: function (data) {
    return '<p class="signature">' + (data.name || "Nombre del autor") + "</p>";
  },
  toPreview: function (data) {
    return (
      '<p style="text-align:right;font-style:italic">' +
      (data.name || "") +
      "</p>"
    );
  },
});

CMS.registerEditorComponent({
  id: "lugar-fecha",
  label: "Lugar y fecha",
  fields: [
    {
      name: "text",
      label: "Lugar y fecha",
      widget: "string",
      default: "Ciudad, fecha",
    },
  ],
  pattern: /^<p class="epistolary-meta">(.*?)<\/p>$/ms,
  fromBlock: function (match) {
    return { text: match[1] };
  },
  toBlock: function (data) {
    return (
      '<p class="epistolary-meta">' + (data.text || "Ciudad, fecha") + "</p>"
    );
  },
  toPreview: function (data) {
    return (
      '<p style="text-align:right;opacity:0.8">' + (data.text || "") + "</p>"
    );
  },
});
