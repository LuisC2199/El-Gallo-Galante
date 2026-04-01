// ---------------------------------------------------------------------------
// Admin – Block-styling plugin for Milkdown
// ---------------------------------------------------------------------------
//
// Extends paragraph and heading schemas with `textAlign` and `fontSize`
// attributes.
//
// SERIALIZATION POLICY
// ─────────────────────
// textAlign is serialized as an inline prefix at the very start of the
// block's text content:
//
//   :::align-right:::*Guanajuato, a 01 de julio de 2020*
//   :::align-center:::Centered content
//
// Round-trip:
//   toMarkdown  → opens paragraph, addNode("text", ":::align-TYPE:::"),
//                 then state.next(inline content), closeNode
//   remark-parse → paragraph whose first child is text(":::align-TYPE:::")
//   remarkAlignPlugin → strips prefix, sets data.textAlign
//   parseMarkdown.runner → sets ProseMirror textAlign attr
//   toDOM → applies style="text-align:TYPE"
//
// "left" is the default; it is NOT serialized with a prefix (saving
// `:::align-left:::` would be no-op on reload since left is default).
//
// fontSize is EDITOR-VISUAL-ONLY – never written to the markdown file.
//
// LEGACY SUPPORT
// ──────────────
// Existing <p style="text-align:..."> HTML blocks are still loaded
// correctly and will be converted to :::align-TYPE::: on next save.
// ---------------------------------------------------------------------------

import { $node, $remark } from "@milkdown/kit/utils";
import {
  paragraphAttr,
  headingAttr,
  headingIdGenerator,
} from "@milkdown/kit/preset/commonmark";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TextAlign = "left" | "center" | "right" | "justify";
const VALID_ALIGNS = new Set<string>(["left", "center", "right", "justify"]);
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export type FontSizeKey = "xs" | "sm" | "md" | "lg" | "xl";
export const FONT_SIZE_MAP: Record<FontSizeKey, string> = {
  xs: "0.8rem",
  sm: "0.9rem",
  md: "",      // default – no inline style
  lg: "1.15rem",
  xl: "1.35rem",
};
export const FONT_SIZE_LABELS: Record<FontSizeKey, string> = {
  xs: "XS",
  sm: "S",
  md: "M",
  lg: "L",
  xl: "XL",
};

const remToKey = new Map(Object.entries(FONT_SIZE_MAP).filter(([, v]) => v).map(([k, v]) => [v, k]));

// ---------------------------------------------------------------------------
// Alignment prefix constant
// ---------------------------------------------------------------------------
//
// SYNTAX:   :::align-(left|center|right|justify):::
// POSITION: very first inline node of a paragraph or heading in saved markdown
//
// WHY NOT raw HTML:
//   A previous implementation emitted <p style="text-align:...">. This caused
//   the full paragraph to be serialized as raw HTML, which meant bold/italic
//   marks also became HTML (<strong>, <em>) and the file lost clean markdown
//   formatting.  The prefix approach keeps all inline content in standard
//   CommonMark; only the alignment token is non-standard, and only at the
//   very start of the block.
//
// DUPLICATE PREFIX safety:
//   The ProseMirror document never contains :::align-TYPE::: as text,
//   because remarkAlignPlugin always strips the prefix BEFORE parseMarkdown
//   runner runs.  So the text nodes in PM are always clean.  The prefix is
//   only ever added again by toMarkdown – it cannot be duplicated.
//
// SWITCHING ALIGNMENT (right → center, right → left, etc.):
//   setTextAlign() calls setNodeMarkup to update the PM textAlign attr.
//   The next toMarkdown run emits the new prefix (or omits it for left/null).
//   The old prefix was never in the PM text nodes, so no cleanup is needed.
//
// REMOVING ALIGNMENT (right → none):
//   setTextAlign("left") sets the effectiveAlign to null (see FormattingToolbar).
//   toMarkdown omits the prefix entirely for null/left.  Clean markdown.
//
// EMPTY BLOCKS:
//   A block with alignment but no content serializes as just ":::align-TYPE:::"
//   on its own line.  On reload stripAlignPrefix removes it, leaving an empty
//   children array.  parseMarkdown.runner produces an empty PM node.  Safe.
//
// COPY/PASTE in editor:
//   ProseMirror copies the textAlign attr with the node.  Pasted aligned
//   paragraphs retain their alignment.  The prefix is only in the saved file,
//   never in the ProseMirror DOM, so paste never introduces a raw prefix.
//
// TYPING THE LITERAL PREFIX:
//   If an author manually types ":::align-right:::" into the editor it becomes
//   a plain text node (no textAlign attr).  On save no prefix is prepended
//   (the attr is null), so the file contains ":::align-right:::" as literal
//   text.  On reload remarkAlignPlugin then treats the paragraph as right-
//   aligned.  This is an unlikely but acknowledged edge case; it is consistent
//   and reversible (delete the text, save again).
//
// FORMAT CONTRACT (must stay in sync with remark-align-public.mjs and
//                   PostPreviewPanel.tsx):
//   /^:::align-(left|center|right|justify):::/
//   "left" is never serialized (it is the default).
// ---------------------------------------------------------------------------
const ALIGN_PREFIX_RE = /^:::align-(left|center|right|justify):::/;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * If the first text child of a paragraph/heading mdast node begins with
 * :::align-TYPE:::, strip the prefix and return the alignment string.
 * Returns null when no prefix is present.
 */
function stripAlignPrefix(node: any): string | null {
  const children: any[] = node.children;
  if (!children || children.length === 0) return null;

  const first = children[0];
  if (first.type !== "text") return null;

  const match = ALIGN_PREFIX_RE.exec(first.value as string);
  if (!match) return null;

  const remaining = (first.value as string).slice(match[0].length);
  if (remaining === "") {
    // Prefix was the only content of the first child – remove it entirely
    children.splice(0, 1);
  } else {
    // Trim just the prefix from the first child's value
    children[0] = { ...first, value: remaining };
  }
  return match[1];
}

/* eslint-enable @typescript-eslint/no-explicit-any */

function sanitizeAlign(value: unknown): TextAlign | null {
  if (typeof value === "string" && VALID_ALIGNS.has(value)) return value as TextAlign;
  return null;
}

function sanitizeFontSize(value: unknown): FontSizeKey | null {
  if (typeof value === "string" && value in FONT_SIZE_MAP && value !== "md") return value as FontSizeKey;
  return null;
}

function fontSizeFromRem(rem: string | undefined | null): FontSizeKey | null {
  if (!rem) return null;
  const key = remToKey.get(rem);
  return key ? (key as FontSizeKey) : null;
}

// ---------------------------------------------------------------------------
// Remark plugin – load-time alignment detection
// Handles:
//   1. New format:    :::align-TYPE::: inline prefix on paragraph/heading
//   2. Legacy format: <p style="text-align:..."> HTML blocks
//      (these are converted to the new format on next save)
// ---------------------------------------------------------------------------
//
// When Milkdown (remark) parses markdown that contains e.g.
//   :::align-right:::Hello *world*
// it creates a paragraph whose first child is text(":::align-right:::").
// This plugin strips the prefix and sets data.textAlign on the mdast node
// so that parseMarkdown.runner can set the ProseMirror attr.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
const STYLED_P_RE =
  /^<p\s+style="([^"]+)">[\s\S]*?<\/p>$/i;
const STYLED_H_RE =
  /^<h([1-6])\s+style="([^"]+)">[\s\S]*?<\/h\1>$/i;

function parseStyleString(style: string): { textAlign: string | null; fontSize: FontSizeKey | null } {
  let textAlign: string | null = null;
  let fontSize: FontSizeKey | null = null;
  for (const part of style.split(";")) {
    const [prop, val] = part.split(":").map(s => s.trim());
    if (prop === "text-align" && val && VALID_ALIGNS.has(val)) textAlign = val;
    if (prop === "font-size" && val) fontSize = fontSizeFromRem(val);
  }
  return { textAlign, fontSize };
}

function extractInnerHtml(tag: string, html: string): string {
  const open = html.indexOf(">");
  const close = html.lastIndexOf("</");
  if (open === -1 || close === -1) return "";
  return html.slice(open + 1, close);
}

function htmlToMdastChildren(html: string): any[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return domChildrenToMdast(doc.body);
}

function domChildrenToMdast(el: Node): any[] {
  const out: any[] = [];
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text) out.push({ type: "text", value: text });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as HTMLElement).tagName.toLowerCase();
      const inner = domChildrenToMdast(child);
      if (tag === "strong" || tag === "b") {
        out.push({ type: "strong", children: inner });
      } else if (tag === "em" || tag === "i") {
        out.push({ type: "emphasis", children: inner });
      } else if (tag === "a") {
        out.push({
          type: "link",
          url: (child as HTMLElement).getAttribute("href") ?? "",
          children: inner,
        });
      } else if (tag === "code") {
        out.push({ type: "inlineCode", value: child.textContent ?? "" });
      } else if (tag === "br") {
        out.push({ type: "break" });
      } else if (tag === "span") {
        // Pass through spans (e.g. dropcap) as inline html
        out.push({ type: "html", value: (child as HTMLElement).outerHTML });
      } else {
        // Fallback: just extract text
        out.push({ type: "text", value: child.textContent ?? "" });
      }
    }
  }
  return out;
}

export const remarkAlignPlugin = $remark("remarkAlign", () => () => (tree: any) => {
  if (!tree.children) return;

  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i];

    // 1. New format: :::align-TYPE::: prefix on paragraph or heading node.
    //    remark-parse already resolved these into proper block nodes; we just
    //    need to strip the prefix text and attach the alignment as data.
    if (node.type === "paragraph" || node.type === "heading") {
      const align = stripAlignPrefix(node);
      if (align) {
        node.data = { ...(node.data ?? {}), textAlign: align };
      }
      continue; // no further processing needed for these node types
    }

    // 2. Legacy format: raw HTML blocks emitted by the old serializer.
    //    Convert on load; the new serializer will write clean syntax on save.
    if (node.type !== "html") continue;

    const pMatch = STYLED_P_RE.exec(node.value);
    if (pMatch) {
      const { textAlign, fontSize } = parseStyleString(pMatch[1]);
      if (textAlign || fontSize) {
        tree.children[i] = {
          type: "paragraph",
          children: htmlToMdastChildren(extractInnerHtml("p", node.value)),
          data: { textAlign, fontSize },
        };
        continue;
      }
    }

    const hMatch = STYLED_H_RE.exec(node.value);
    if (hMatch) {
      const { textAlign, fontSize } = parseStyleString(hMatch[2]);
      if (textAlign || fontSize) {
        tree.children[i] = {
          type: "heading",
          depth: Number(hMatch[1]),
          children: htmlToMdastChildren(extractInnerHtml(`h${hMatch[1]}`, node.value)),
          data: { textAlign, fontSize },
        };
      }
    }
  }
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Extended paragraph schema – adds textAlign + fontSize attrs
// ---------------------------------------------------------------------------

// Helper to build inline style string from attrs
function buildStyle(node: any): string {
  const parts: string[] = [];
  if (node.attrs.textAlign) parts.push(`text-align: ${node.attrs.textAlign}`);
  if (node.attrs.fontSize && FONT_SIZE_MAP[node.attrs.fontSize as FontSizeKey])
    parts.push(`font-size: ${FONT_SIZE_MAP[node.attrs.fontSize as FontSizeKey]}`);
  return parts.join("; ");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const alignedParagraph = $node("paragraph", (ctx) => ({
  content: "inline*",
  group: "block",
  attrs: {
    textAlign: { default: null },
    fontSize: { default: null },
  },
  parseDOM: [
    {
      tag: "p",
      getAttrs: (dom: any) => ({
        textAlign: sanitizeAlign(dom?.style?.textAlign),
        fontSize: fontSizeFromRem(dom?.style?.fontSize),
      }),
    },
  ],
  toDOM: (node: any) => {
    const base = ctx.get(paragraphAttr.key)(node);
    const style = buildStyle(node);
    if (style) {
      return ["p", { ...base, style }, 0];
    }
    return ["p", base, 0];
  },
  parseMarkdown: {
    match: (node: any) => node.type === "paragraph",
    runner: (state: any, node: any, type: any) => {
      const textAlign = sanitizeAlign(node.data?.textAlign);
      const fontSize = sanitizeFontSize(node.data?.fontSize);
      state.openNode(type, { textAlign, fontSize });
      if (node.children) state.next(node.children);
      else state.addText(node.value || "");
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === "paragraph",
    // Alignment is persisted as a :::align-TYPE::: prefix at the start of the
    // paragraph's inline content.  remark-parse treats it as plain text, so
    // it survives the round-trip.  On reload, remarkAlignPlugin strips it and
    // sets data.textAlign, which parseMarkdown.runner maps to the PM attr.
    // ⚠ Do NOT change this to raw HTML – that was the original bug.
    runner: (state: any, node: any) => {
      const align: string | null = node.attrs.textAlign;
      state.openNode("paragraph");
      // Emit prefix only for non-default (non-left) alignment
      if (align && align !== "left") {
        state.addNode("text", undefined, `:::align-${align}:::`);
      }
      if (node.content && node.content.size > 0) {
        state.next(node.content);
      }
      state.closeNode();
    },
  },
}));

// ---------------------------------------------------------------------------
// Extended heading schema – adds textAlign + fontSize attrs
// ---------------------------------------------------------------------------

export const alignedHeading = $node("heading", (ctx) => {
  const getId = ctx.get(headingIdGenerator.key);
  return {
    content: "inline*",
    group: "block",
    defining: true,
    attrs: {
      id: { default: "" },
      level: { default: 1 },
      textAlign: { default: null },
      fontSize: { default: null },
    },
    parseDOM: HEADING_LEVELS.map((x) => ({
      tag: `h${x}`,
      getAttrs: (dom: any) => {
        if (!(dom instanceof HTMLElement))
          throw new TypeError("Expected HTMLElement");
        return {
          level: x,
          id: dom.id,
          textAlign: sanitizeAlign(dom.style?.textAlign),
          fontSize: fontSizeFromRem(dom.style?.fontSize),
        };
      },
    })),
    toDOM: (node: any) => {
      const base = {
        ...ctx.get(headingAttr.key)(node),
        id: node.attrs.id || getId(node),
      };
      const style = buildStyle(node);
      if (style) {
        return [
          `h${node.attrs.level}`,
          { ...base, style },
          0,
        ];
      }
      return [`h${node.attrs.level}`, base, 0];
    },
    parseMarkdown: {
      match: ({ type }: any) => type === "heading",
      runner: (state: any, node: any, type: any) => {
        const textAlign = sanitizeAlign(node.data?.textAlign);
        const fontSize = sanitizeFontSize(node.data?.fontSize);
        state.openNode(type, { level: node.depth, textAlign, fontSize });
        state.next(node.children);
        state.closeNode();
      },
    },
    toMarkdown: {
      match: (node: any) => node.type.name === "heading",
      // Same :::align-TYPE::: prefix strategy as paragraphs.
      // ⚠ Do NOT change this to raw HTML.
      runner: (state: any, node: any) => {
        const align: string | null = node.attrs.textAlign;
        state.openNode("heading", undefined, {
          depth: node.attrs.level,
        });
        if (align && align !== "left") {
          state.addNode("text", undefined, `:::align-${align}:::`);
        }
        // Guard matches the paragraph runner – calling state.next on an empty
        // ProseMirror fragment is a no-op in practice, but the explicit check
        // makes the intent clear and avoids any version-specific edge cases.
        if (node.content && node.content.size > 0) {
          state.next(node.content);
        }
        state.closeNode();
      },
    },
  };
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Convenience array – register all three plugins with .use(textAlignPlugins)
// ---------------------------------------------------------------------------

export const textAlignPlugins = [
  remarkAlignPlugin,
  alignedParagraph,
  alignedHeading,
].flat();
