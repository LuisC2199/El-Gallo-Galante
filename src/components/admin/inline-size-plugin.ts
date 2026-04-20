// ---------------------------------------------------------------------------
// Admin – Inline text-size plugin for Milkdown
// ---------------------------------------------------------------------------
//
// Defines a `textSize` inline ProseMirror node that wraps selected text with
// a font-size visual style. Unlike the block-level `fontSize` attr on
// paragraphs and headings, this node targets only the selected text range.
//
// SERIALIZATION FORMAT
// ─────────────────────
// `textSize` nodes are serialized as inline HTML spans:
//   <span style="font-size: 2rem">text content</span>
//
// On load, `remarkInlineSizePlugin` detects these HTML spans in the mdast
// tree and converts them to `inlineSize` mdast nodes. The ProseMirror schema's
// `parseMarkdown.runner` then converts those to `textSize` ProseMirror nodes.
//
// ROUND-TRIP
//   Editor → toMarkdown → <span style="...">content</span> in markdown
//   Load   → remark + remarkInlineSizePlugin → inlineSize mdast node
//           → parseMarkdown.runner → textSize ProseMirror node
//
// PUBLIC RENDERING
//   Astro renders raw inline HTML in markdown content collections by default,
//   so the <span style="..."> tags appear as-is in the final HTML output.
//   No additional remark plugin or CSS class is needed on the public site.
// ---------------------------------------------------------------------------

import { $node, $remark } from "@milkdown/kit/utils";
import { FONT_SIZE_MAP, type FontSizeKey } from "./text-align-plugin";

// ---------------------------------------------------------------------------
// CSS ↔ size-key reverse mapping
// ---------------------------------------------------------------------------

const CSS_TO_SIZE_KEY = new Map<string, FontSizeKey>(
  (Object.entries(FONT_SIZE_MAP) as [FontSizeKey, string][])
    .filter(([, v]) => v !== "")
    .map(([k, v]) => [v, k]),
);

// ---------------------------------------------------------------------------
// Remark plugin – load-time span detection
// ---------------------------------------------------------------------------

const SPAN_OPEN_RE = /^<span\s+style="font-size:\s*([^"]+)"\s*>/i;
const SPAN_CLOSE_RE = /^<\/span>$/i;

/* eslint-disable @typescript-eslint/no-explicit-any */

function consolidateSpans(children: any[]): any[] {
  const result: any[] = [];
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    if (child.type === "html") {
      const match = SPAN_OPEN_RE.exec(child.value as string);
      if (match) {
        const cssValue = (match[1] as string).trim();
        const sizeKey = CSS_TO_SIZE_KEY.get(cssValue);
        if (sizeKey) {
          // Collect inner nodes until the matching </span>
          i++;
          const inner: any[] = [];
          let depth = 1;
          while (i < children.length) {
            const c = children[i];
            if (c.type === "html") {
              if (SPAN_OPEN_RE.test(c.value as string)) {
                depth++;
              } else if (SPAN_CLOSE_RE.test((c.value as string).trim())) {
                depth--;
                if (depth === 0) {
                  i++;
                  break;
                }
              }
            }
            inner.push(c);
            i++;
          }
          // Recursively process inner content to handle nested spans
          const processedInner = consolidateSpans(inner);
          result.push({ type: "inlineSize", size: sizeKey, children: processedInner });
          continue;
        }
      }
    }
    result.push(child);
    i++;
  }
  return result;
}

function processNode(node: any): void {
  if (!node.children) return;
  // Recurse into children first
  for (const child of node.children) processNode(child);
  // Only consolidate spans in paragraph/heading inline content
  if (
    (node.type === "paragraph" || node.type === "heading") &&
    node.children.some((c: any) => c.type === "html")
  ) {
    node.children = consolidateSpans(node.children);
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export const remarkInlineSizePlugin = $remark(
  "remarkInlineSize",
  () => () => (tree: any) => {
    processNode(tree);
  },
);

// ---------------------------------------------------------------------------
// `textSize` inline ProseMirror node
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

export const textSizeNode = $node("textSize", () => ({
  group: "inline",
  inline: true,
  content: "inline*",
  attrs: {
    size: { default: "14" },
  },
  parseDOM: [
    {
      tag: "span[style]",
      getAttrs: (dom: any) => {
        const fontSize = dom?.style?.fontSize as string | undefined;
        if (!fontSize) return false;
        const sizeKey = CSS_TO_SIZE_KEY.get(fontSize);
        if (!sizeKey) return false;
        return { size: sizeKey };
      },
    },
  ],
  toDOM: (node: any) => {
    const cssValue = FONT_SIZE_MAP[node.attrs.size as FontSizeKey];
    if (!cssValue) return ["span", 0];
    return ["span", { style: `font-size: ${cssValue}` }, 0];
  },
  parseMarkdown: {
    match: (node: any) => node.type === "inlineSize",
    runner: (state: any, node: any, type: any) => {
      state.openNode(type, { size: node.size });
      if (node.children && node.children.length > 0) state.next(node.children);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === "textSize",
    runner: (state: any, node: any) => {
      const cssValue = FONT_SIZE_MAP[node.attrs.size as FontSizeKey];
      if (!cssValue) {
        // Default/unknown size — serialize content inline without wrapper
        if (node.content && node.content.size > 0) state.next(node.content);
        return;
      }
      // Add opening tag, then content, then closing tag — all as siblings
      // in the currently open parent node (the paragraph).
      state.addNode("html", undefined, `<span style="font-size: ${cssValue}">`);
      if (node.content && node.content.size > 0) state.next(node.content);
      state.addNode("html", undefined, `</span>`);
    },
  },
}));

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const inlineSizePlugins = [remarkInlineSizePlugin, textSizeNode].flat();
