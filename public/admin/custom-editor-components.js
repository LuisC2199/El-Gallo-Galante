// =============================================================================
// Decap CMS — Custom Editor Components for El Gallo Galante
// =============================================================================
// These editor components add toolbar buttons to the Markdown widget so that
// editors can insert preformatted HTML blocks without writing raw HTML.
//
// Loaded from /public/admin/index.html after decap-cms.js.
// =============================================================================

CMS.registerEditorComponent({
  id: "letra-capitular",
  label: "Letra capitular",
  fields: [
    {
      name: "letter",
      label: "Letra",
      widget: "string",
      default: "A",
    },
  ],
  pattern: /^<span class="dropcap">(.*?)<\/span>$/ms,
  fromBlock: function (match) {
    return { letter: match[1] };
  },
  toBlock: function (data) {
    return '<span class="dropcap">' + (data.letter || "A").charAt(0) + "</span>";
  },
  toPreview: function (data) {
    return (
      '<span style="float:left;font-family:Playfair Display,serif;font-size:3.5em;line-height:0.9;padding-right:0.12em;padding-top:0.05em">' +
      (data.letter || "A").charAt(0) +
      "</span>"
    );
  },
});


