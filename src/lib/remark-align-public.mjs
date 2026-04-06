// ---------------------------------------------------------------------------
// remark-align-public – server-side companion to the admin block-style plugin
// ---------------------------------------------------------------------------
//
// PURPOSE
// ───────
// The Milkdown editor saves textAlign and lineSpacing using an inline prefix
// at the very start of a paragraph or heading's text content:
//
//   :::align-right:::*italic text*
//   :::align-center ls-relaxed:::Centered + relaxed spacing
//   :::ls-compact:::Compact-spaced, default alignment
//
// Grammar:  :::[TOKEN[ TOKEN]]:::
//   align tokens:   align-left | align-center | align-right | align-justify
//   spacing tokens: ls-compact | ls-normal  | ls-relaxed  | ls-loose
//
// When Astro's content pipeline renders post markdown for the public site
// those prefix strings appear verbatim in the output HTML without this plugin.
// This plugin strips them and attaches inline CSS (via data.hProperties.style)
// so rehype produces the correct element attributes.
//
// SCOPE
// ─────
// Only paragraphs and headings are processed (the only block types the editor
// schema carries block-style attrs on).
//
// LEGACY HTML
// ───────────
// Old-format `<p style="text-align:...">` blocks written by the v1 serializer
// are raw `html` mdast nodes passed through rehype-raw – no action needed.
//
// ROUND-TRIP GUARANTEE
// ─────────────────────
// Read-only from the file system.  Modifies the in-memory mdast only.
// Runs at Astro build time (SSG) and at runtime (SSR) for dynamic pages.
//
// FORMAT CONTRACT (must stay in sync with text-align-plugin.ts and
//                   PostPreviewPanel.tsx)
// ──────────────────────────────────────
//   BLOCK_PREFIX_RE = /^:::([^:]+):::/
//   Align token:   align-(left|center|right|justify)
//   Spacing token: ls-(compact|normal|relaxed|loose)
//   "left" and "normal" are never serialized (default values).
// ---------------------------------------------------------------------------

const BLOCK_PREFIX_RE = /^:::([^:]+):::/;
const VALID_ALIGNS    = new Set(["left", "center", "right", "justify"]);

// Maps line-spacing token name → CSS line-height value.
// "normal" maps to "" (default) and is never serialized, but handle it
// gracefully if somehow encountered.
const LINE_SPACING_CSS = {
  compact: "1.2",
  normal:  "",
  relaxed: "1.75",
  loose:   "2.0",
};

/**
 * @returns {import('unified').Plugin}
 */
export function remarkAlignPublic() {
  return function (tree) {
    if (!tree.children) return;

    for (const node of tree.children) {
      // Only paragraphs and headings carry block-style attrs.
      if (node.type !== "paragraph" && node.type !== "heading") continue;

      const children = node.children;
      if (!children || children.length === 0) continue;

      const first = children[0];
      // The prefix is always a plain text node; a block starting with
      // emphasis/strong/link has no alignment prefix.
      if (first.type !== "text") continue;

      const match = BLOCK_PREFIX_RE.exec(first.value);
      if (!match) continue;

      // Parse space-separated tokens inside ::: :::
      const tokens = match[1].trim().split(/\s+/);
      let align = null;
      let ls    = null;

      for (const token of tokens) {
        if (token.startsWith("align-") && VALID_ALIGNS.has(token.slice(6))) {
          align = token.slice(6);
        } else if (token.startsWith("ls-") && token.slice(3) in LINE_SPACING_CSS) {
          ls = token.slice(3);
        }
      }

      // Strip the prefix from the first text child.
      const remaining = first.value.slice(match[0].length);
      if (remaining === "") {
        children.splice(0, 1);
      } else {
        children[0] = { ...first, value: remaining };
      }

      // Build CSS style string and attach via data.hProperties so rehype
      // adds it as an HTML attribute.  Inline style wins over any class-level
      // leading on the outer prose wrapper.
      const styles = [];
      if (align && align !== "left")                          styles.push(`text-align: ${align}`);
      if (ls && ls !== "normal" && LINE_SPACING_CSS[ls])      styles.push(`line-height: ${LINE_SPACING_CSS[ls]}`);

      if (styles.length > 0) {
        node.data = node.data ?? {};
        node.data.hProperties = {
          ...(node.data.hProperties ?? {}),
          style: styles.join("; "),
        };
      }
    }
  };
}

