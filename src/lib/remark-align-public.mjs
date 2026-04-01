// ---------------------------------------------------------------------------
// remark-align-public – server-side companion to the editor's text-align plugin
// ---------------------------------------------------------------------------
//
// PURPOSE
// ───────
// The Milkdown editor saves alignment using an inline prefix syntax:
//
//   :::align-right:::*italic text*
//   :::align-center:::Centered paragraph
//
// When Astro's content pipeline renders post markdown for the public site,
// it runs a plain remark/rehype pass.  Without this plugin those prefix
// strings appear verbatim in the output HTML.  This plugin strips them and
// attaches the corresponding `style="text-align:TYPE"` attribute so rehype
// produces the correct element.
//
// SCOPE
// ─────
// Only paragraphs and headings are supported (those are the only block types
// that grow a textAlign attr in the editor schema).
//
// LEGACY HTML
// ───────────
// Old-format `<p style="text-align:...">` HTML blocks written by the v1
// serializer are raw `html` mdast nodes.  Astro passes them through rehype-raw
// so they render correctly with no changes needed here.
//
// ROUND-TRIP GUARANTEE
// ─────────────────────
// This plugin is READ-ONLY from the file system perspective – it modifies the
// in-memory mdast only and never rewrites markdown files.  It runs at build
// time (SSG) and at runtime (SSR) for dynamic pages.
//
// FORMAT CONTRACT (must stay in sync with text-align-plugin.ts)
// ──────────────────────────────────────────────────────────────
//   Prefix:  :::align-(left|center|right|justify):::
//   Position: very first text child of the block node
//   "left" is never serialized (it is the default); but if encountered it
//   is safely handled.
// ---------------------------------------------------------------------------

const ALIGN_PREFIX_RE = /^:::align-(left|center|right|justify):::/;

/**
 * @returns {import('unified').Plugin}
 */
export function remarkAlignPublic() {
  return function (tree) {
    if (!tree.children) return;

    for (const node of tree.children) {
      // Only paragraphs and headings carry alignment.
      if (node.type !== "paragraph" && node.type !== "heading") continue;

      const children = node.children;
      if (!children || children.length === 0) continue;

      const first = children[0];
      // The prefix is always in a plain text node; if the block starts with
      // emphasis/strong/link there is no alignment prefix to strip.
      if (first.type !== "text") continue;

      const match = ALIGN_PREFIX_RE.exec(first.value);
      if (!match) continue;

      const align = match[1];
      const remaining = first.value.slice(match[0].length);

      // Strip the prefix from the first text child.
      if (remaining === "") {
        // Prefix occupied the entire first text node – remove it.
        children.splice(0, 1);
      } else {
        // Prefix was followed by more text in the same node (e.g. plain text
        // paragraph with no inline marks).
        children[0] = { ...first, value: remaining };
      }

      // Attach the style so that rehype adds it as an HTML attribute.
      // `data.hProperties` is the standard remark→rehype property bridge.
      node.data = node.data ?? {};
      node.data.hProperties = {
        ...(node.data.hProperties ?? {}),
        style: `text-align: ${align}`,
      };
    }
  };
}
