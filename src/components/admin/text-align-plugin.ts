// ---------------------------------------------------------------------------
// Admin – Block-styling plugin for Milkdown
// ---------------------------------------------------------------------------
//
// Extends paragraph and heading schemas with `textAlign` and `fontSize`
// attributes.
//
// Styled paragraphs are serialised to markdown as HTML blocks, e.g.
//   <p style="text-align: center; font-size: 1.35rem">some text</p>
//
// A companion remark plugin converts those HTML blocks back to paragraphs
// on load so they remain editable (round-trip).
// ---------------------------------------------------------------------------

import { $node, $remark } from "@milkdown/kit/utils";
import { schemaCtx, editorViewCtx } from "@milkdown/kit/core";
import { DOMSerializer } from "@milkdown/kit/prose/model";
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
// Helper – serialise ProseMirror fragment to an HTML string
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function fragmentToHtml(ctx: any, node: any): string {
  const schema = ctx.get(schemaCtx);
  const serializer = DOMSerializer.fromSchema(schema);
  const frag = serializer.serializeFragment(node.content);
  const div = document.createElement("div");
  div.appendChild(frag);
  return div.innerHTML;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Remark plugin – convert aligned HTML blocks back to paragraph/heading nodes
// ---------------------------------------------------------------------------
//
// When Milkdown (remark) parses markdown that contains e.g.
//   <p style="text-align: center">Hello <strong>world</strong></p>
// it creates an mdast `html` node.  This plugin rewrites those nodes to
// `paragraph` (or `heading`) nodes so the content is editable.
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

function hasCustomStyle(node: any): boolean {
  return !!(node.attrs.textAlign || node.attrs.fontSize);
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
    runner: (state: any, node: any) => {
      if (hasCustomStyle(node)) {
        const html = fragmentToHtml(ctx, node);
        const style = buildStyle(node);
        state.addNode(
          "html",
          undefined,
          `<p style="${style}">${html}</p>`,
        );
      } else {
        state.openNode("paragraph");
        // Replicate the default empty-line-preservation behaviour
        if (!node.content || node.content.size === 0) {
          try {
            const lastNode = ctx.get(editorViewCtx).state?.doc.lastChild;
            if (node !== lastNode) state.addNode("html", undefined, "<br />");
          } catch {
            /* noop */
          }
        } else {
          state.next(node.content);
        }
        state.closeNode();
      }
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
      runner: (state: any, node: any) => {
        if (hasCustomStyle(node)) {
          const html = fragmentToHtml(ctx, node);
          const style = buildStyle(node);
          state.addNode(
            "html",
            undefined,
            `<h${node.attrs.level} style="${style}">${html}</h${node.attrs.level}>`,
          );
        } else {
          state.openNode("heading", undefined, {
            depth: node.attrs.level,
          });
          state.next(node.content);
          state.closeNode();
        }
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
