// ---------------------------------------------------------------------------
// Admin – Block-styling plugin for Milkdown
// ---------------------------------------------------------------------------
//
// Extends paragraph and heading schemas with `textAlign`, `lineSpacing`,
// and `fontSize` attributes.
//
// SERIALIZATION POLICY
// ─────────────────────
// textAlign and lineSpacing are serialized as an inline prefix at the very
// start of the block's text content:
//
//   :::align-right:::*italic text*
//   :::align-center ls-relaxed:::Centered + relaxed spacing
//   :::ls-compact:::Compact-spaced, default alignment
//
// Grammar:  :::[TOKEN[ TOKEN]]:::
//   align tokens:   align-left | align-center | align-right | align-justify
//   spacing tokens: ls-compact | ls-normal  | ls-relaxed  | ls-loose
// Tokens are space-separated; by convention align comes before ls.
//
// Round-trip:
//   toMarkdown  → buildBlockPrefix(align, ls) → text node, then inline content
//   remark-parse → first text child is ":::{tokens}:::[rest]"
//   remarkAlignPlugin → parseBlockPrefix strips prefix, sets data.textAlign
//                       and data.lineSpacing on the mdast node
//   parseMarkdown.runner → sets ProseMirror textAlign + lineSpacing attrs
//   toDOM → applies style="text-align:X; line-height:Y"
//
// Defaults NOT serialized (omitting them is a no-op on reload):
//   textAlign   = "left"   → align token omitted
//   lineSpacing = "normal" → ls token omitted
//
// fontSize is EDITOR-VISUAL-ONLY – never written to the markdown file.
//
// LEGACY SUPPORT
// ──────────────
// Existing <p style="text-align:..."> HTML blocks are still loaded
// correctly and will be converted to the new prefix syntax on next save.
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

// Line spacing tokens → CSS line-height values.
// "normal" is the default and is NEVER serialized to markdown (analogous to
// how "left" is never serialized for textAlign).
export type LineSpacingKey = "compact" | "normal" | "relaxed" | "loose";
export const LINE_SPACING_MAP: Record<LineSpacingKey, string> = {
  compact: "1.2",
  normal:  "",      // default – no inline style
  relaxed: "1.75",
  loose:   "2.0",
};
export const LINE_SPACING_LABELS: Record<LineSpacingKey, string> = {
  compact: "Compacto",
  normal:  "Normal",
  relaxed: "Relajado",
  loose:   "Amplio",
};

const remToKey = new Map(Object.entries(FONT_SIZE_MAP).filter(([, v]) => v).map(([k, v]) => [v, k]));
// Maps raw CSS line-height strings back to LineSpacingKey (for legacy HTML migration).
const lineHeightToKey = new Map<string, LineSpacingKey>([
  ["1.2",  "compact"],
  ["1.75", "relaxed"],
  ["2",    "loose"],
  ["2.0",  "loose"],
]);

// ---------------------------------------------------------------------------
// Block-style prefix – combined serialization of alignment + line spacing
// ---------------------------------------------------------------------------
//
// SYNTAX:    :::[TOKEN[ TOKEN]]:::
// POSITION:  very first text child of a paragraph or heading
// TOKENS:    align-TYPE and/or ls-KEY, space-separated
//
// FORMAT CONTRACT (must stay in sync with remark-align-public.mjs and
//                   PostPreviewPanel.tsx):
//   Match regex: /^:::([^:]+):::/   (colons never appear inside the brackets)
//   Align tokens:   align-left | align-center | align-right | align-justify
//   Spacing tokens: ls-compact | ls-normal  | ls-relaxed  | ls-loose
//
// BACKWARD COMPATIBILITY:
//   Old files with :::align-TYPE::: (no ls token) match BLOCK_PREFIX_RE and
//   produce lineSpacing = null.  No migration needed.
//
// COEXISTENCE (align + lineSpacing):
//   Both attrs are encoded in one prefix node.  Changing one only rebuilds
//   the prefix from the live ProseMirror attrs – the old text was never in PM.
//
// DUPLICATE PREFIX: impossible.  Prefix is stripped before PM sees the text.
//   toMarkdown re-adds it once from node.attrs.  Cannot accumulate.
//
// REMOVING a setting:
//   Setting align → "left" or lineSpacing → "normal" removes that token.
//   If both are default, no prefix is emitted at all.  Clean markdown.
// ---------------------------------------------------------------------------
const BLOCK_PREFIX_RE = /^:::([^:]+):::/;

/** @internal */
interface BlockStyle {
  align: string | null;
  lineSpacing: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Parse and strip the block-style prefix from the first text child of a
 * paragraph or heading mdast node.
 *
 * Returns { align, lineSpacing } from the parsed tokens (both may be null).
 * Returns null when no prefix is present at all.
 *
 * Mutates node.children in place so the remaining inline content is clean
 * for parseMarkdown.
 */
function parseBlockPrefix(node: any): BlockStyle | null {
  const children: any[] = node.children;
  if (!children || children.length === 0) return null;

  const first = children[0];
  if (first.type !== "text") return null;

  const match = BLOCK_PREFIX_RE.exec(first.value as string);
  if (!match) return null;

  const tokens = match[1].trim().split(/\s+/);
  let align: string | null = null;
  let lineSpacing: string | null = null;

  for (const token of tokens) {
    if (token.startsWith("align-")) {
      const v = token.slice(6);
      if (VALID_ALIGNS.has(v)) align = v;
    } else if (token.startsWith("ls-")) {
      const v = token.slice(3);
      if (v in LINE_SPACING_MAP) lineSpacing = v;
    }
  }

  const remaining = (first.value as string).slice(match[0].length);
  if (remaining === "") {
    children.splice(0, 1);
  } else {
    children[0] = { ...first, value: remaining };
  }
  return { align, lineSpacing };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

function sanitizeAlign(value: unknown): TextAlign | null {
  if (typeof value === "string" && VALID_ALIGNS.has(value)) return value as TextAlign;
  return null;
}

function sanitizeLineSpacing(value: unknown): LineSpacingKey | null {
  if (typeof value === "string" && value in LINE_SPACING_MAP && value !== "normal")
    return value as LineSpacingKey;
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

function lineSpacingFromCss(lh: string | undefined | null): LineSpacingKey | null {
  if (!lh) return null;
  return lineHeightToKey.get(lh.trim()) ?? null;
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

function parseStyleString(style: string): {
  textAlign: string | null;
  fontSize: FontSizeKey | null;
  lineSpacing: LineSpacingKey | null;
} {
  let textAlign: string | null = null;
  let fontSize: FontSizeKey | null = null;
  let lineSpacing: LineSpacingKey | null = null;
  for (const part of style.split(";")) {
    const [prop, val] = part.split(":").map(s => s.trim());
    if (prop === "text-align" && val && VALID_ALIGNS.has(val)) textAlign = val;
    if (prop === "font-size" && val) fontSize = fontSizeFromRem(val);
    if (prop === "line-height" && val) lineSpacing = lineSpacingFromCss(val);
  }
  return { textAlign, fontSize, lineSpacing };
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

    // 1. New format: :::[tokens]::: prefix on paragraph or heading node.
    //    remark-parse resolved these into block nodes; we parse + strip the
    //    prefix and attach textAlign / lineSpacing as data for parseMarkdown.
    if (node.type === "paragraph" || node.type === "heading") {
      const style = parseBlockPrefix(node);
      if (style) {
        node.data = {
          ...(node.data ?? {}),
          ...(style.align       ? { textAlign: style.align }             : {}),
          ...(style.lineSpacing ? { lineSpacing: style.lineSpacing }     : {}),
        };
      }
      continue; // no further processing needed for paragraph/heading nodes
    }

    // 2. Legacy format: raw HTML blocks emitted by the old serializer.
    //    Convert on load; the new serializer will write clean syntax on save.
    if (node.type !== "html") continue;

    const pMatch = STYLED_P_RE.exec(node.value);
    if (pMatch) {
      const { textAlign, fontSize, lineSpacing } = parseStyleString(pMatch[1]);
      if (textAlign || fontSize || lineSpacing) {
        tree.children[i] = {
          type: "paragraph",
          children: htmlToMdastChildren(extractInnerHtml("p", node.value)),
          data: { textAlign, fontSize, lineSpacing },
        };
        continue;
      }
    }

    const hMatch = STYLED_H_RE.exec(node.value);
    if (hMatch) {
      const { textAlign, fontSize, lineSpacing } = parseStyleString(hMatch[2]);
      if (textAlign || fontSize || lineSpacing) {
        tree.children[i] = {
          type: "heading",
          depth: Number(hMatch[1]),
          children: htmlToMdastChildren(extractInnerHtml(`h${hMatch[1]}`, node.value)),
          data: { textAlign, fontSize, lineSpacing },
        };
      }
    }
  }
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Extended paragraph schema – adds textAlign + fontSize attrs
// ---------------------------------------------------------------------------

/**
 * Build the inline CSS style string for editor visual rendering (toDOM only).
 * Includes text-align, line-height, and font-size when set.
 * An inline style on the block element overrides any class-level leading on
 * the prose wrapper – this is the desired behaviour.
 * ⚠ NOT used in toMarkdown serialization.
 */
function buildStyle(node: any): string {
  const parts: string[] = [];
  if (node.attrs.textAlign)
    parts.push(`text-align: ${node.attrs.textAlign}`);
  if (node.attrs.lineSpacing && LINE_SPACING_MAP[node.attrs.lineSpacing as LineSpacingKey])
    parts.push(`line-height: ${LINE_SPACING_MAP[node.attrs.lineSpacing as LineSpacingKey]}`);
  if (node.attrs.fontSize && FONT_SIZE_MAP[node.attrs.fontSize as FontSizeKey])
    parts.push(`font-size: ${FONT_SIZE_MAP[node.attrs.fontSize as FontSizeKey]}`);
  return parts.join("; ");
}

/**
 * Build the serialized block-prefix token string for toMarkdown.
 * Returns "" when both align and lineSpacing are at their defaults → no prefix.
 * ⚠ NOT used for visual rendering.
 */
function buildBlockPrefix(align: string | null, lineSpacing: string | null): string {
  const tokens: string[] = [];
  if (align && align !== "left") tokens.push(`align-${align}`);
  if (lineSpacing && lineSpacing !== "normal") tokens.push(`ls-${lineSpacing}`);
  return tokens.length > 0 ? `:::${tokens.join(" ")}:::` : "";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const alignedParagraph = $node("paragraph", (ctx) => ({
  content: "inline*",
  group: "block",
  attrs: {
    textAlign:   { default: null },
    lineSpacing: { default: null },
    fontSize:    { default: null },
  },
  parseDOM: [
    {
      tag: "p",
      getAttrs: (dom: any) => ({
        textAlign:   sanitizeAlign(dom?.style?.textAlign),
        lineSpacing: lineSpacingFromCss(dom?.style?.lineHeight),
        fontSize:    fontSizeFromRem(dom?.style?.fontSize),
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
      const textAlign   = sanitizeAlign(node.data?.textAlign);
      const lineSpacing = sanitizeLineSpacing(node.data?.lineSpacing);
      const fontSize    = sanitizeFontSize(node.data?.fontSize);
      state.openNode(type, { textAlign, lineSpacing, fontSize });
      if (node.children) state.next(node.children);
      else state.addText(node.value || "");
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === "paragraph",
    // Per-block styling is persisted as a :::[tokens]::: prefix at the start
    // of the paragraph's inline content.  remark-parse treats it as plain
    // text so it survives the round-trip.  On reload, remarkAlignPlugin
    // parses and strips it, setting data.textAlign / data.lineSpacing;
    // parseMarkdown.runner maps those to ProseMirror attrs.
    // ⚠ Do NOT change this to raw HTML – that was the original bug.
    runner: (state: any, node: any) => {
      const prefix = buildBlockPrefix(node.attrs.textAlign, node.attrs.lineSpacing);
      state.openNode("paragraph");
      if (prefix) {
        state.addNode("text", undefined, prefix);
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
      id:          { default: "" },
      level:       { default: 1 },
      textAlign:   { default: null },
      lineSpacing: { default: null },
      fontSize:    { default: null },
    },
    parseDOM: HEADING_LEVELS.map((x) => ({
      tag: `h${x}`,
      getAttrs: (dom: any) => {
        if (!(dom instanceof HTMLElement))
          throw new TypeError("Expected HTMLElement");
        return {
          level:       x,
          id:          dom.id,
          textAlign:   sanitizeAlign(dom.style?.textAlign),
          lineSpacing: lineSpacingFromCss(dom.style?.lineHeight),
          fontSize:    fontSizeFromRem(dom.style?.fontSize),
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
        const textAlign   = sanitizeAlign(node.data?.textAlign);
        const lineSpacing = sanitizeLineSpacing(node.data?.lineSpacing);
        const fontSize    = sanitizeFontSize(node.data?.fontSize);
        state.openNode(type, { level: node.depth, textAlign, lineSpacing, fontSize });
        state.next(node.children);
        state.closeNode();
      },
    },
    toMarkdown: {
      match: (node: any) => node.type.name === "heading",
      // Same :::[tokens]::: prefix strategy as paragraphs.
      // ⚠ Do NOT change this to raw HTML.
      runner: (state: any, node: any) => {
        const prefix = buildBlockPrefix(node.attrs.textAlign, node.attrs.lineSpacing);
        state.openNode("heading", undefined, {
          depth: node.attrs.level,
        });
        if (prefix) {
          state.addNode("text", undefined, prefix);
        }
        // Guard: calling state.next on an empty fragment is a no-op, but
        // being explicit avoids any version-specific edge cases.
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
