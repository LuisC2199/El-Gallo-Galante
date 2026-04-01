// ---------------------------------------------------------------------------
// Admin – Rich-text formatting toolbar for the Milkdown editor
// ---------------------------------------------------------------------------
//
// Word-like toolbar with bold, italic, headings, alignment, lists,
// blockquote, horizontal rule, link, drop cap, and undo/redo.
// Tracks active marks/nodes to show pressed state.
// Must be rendered inside <MilkdownProvider>.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from "react";
import { useInstance } from "@milkdown/react";
import { editorViewCtx } from "@milkdown/kit/core";
import { callCommand, insert } from "@milkdown/kit/utils";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  turnIntoTextCommand,
  insertHrCommand,
  toggleLinkCommand,
} from "@milkdown/kit/preset/commonmark";
import { undoCommand, redoCommand } from "@milkdown/kit/plugin/history";
import { FONT_SIZE_LABELS, FONT_SIZE_MAP, type FontSizeKey } from "./text-align-plugin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveState {
  bold: boolean;
  italic: boolean;
  heading: number; // 0 = no heading, 1-3 = H1-H3
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  link: boolean;
  textAlign: string | null; // "left" | "center" | "right" | "justify" | null
  fontSize: FontSizeKey | null;
}

const EMPTY_STATE: ActiveState = {
  bold: false,
  italic: false,
  heading: 0,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  link: false,
  textAlign: null,
  fontSize: null,
};

// ---------------------------------------------------------------------------
// Active state detection
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function detectActiveState(view: any): ActiveState {
  const { state } = view;
  const { $from } = state.selection;

  // Check marks (bold/italic/link)
  const marks: any[] = state.storedMarks ?? $from.marks();
  const bold = marks.some((m: any) => m.type.name === "strong");
  const italic = marks.some((m: any) => m.type.name === "emphasis");
  const link = marks.some((m: any) => m.type.name === "link");

  // Walk up node tree to detect heading, list, blockquote
  let heading = 0;
  let bulletList = false;
  let orderedList = false;
  let blockquote = false;
  let textAlign: string | null = null;
  let fontSize: FontSizeKey | null = null;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const name = node.type.name;
    if (name === "heading") {
      heading = node.attrs.level || 0;
      if (!textAlign && node.attrs.textAlign) textAlign = node.attrs.textAlign;
      if (!fontSize && node.attrs.fontSize) fontSize = node.attrs.fontSize;
    } else if (name === "paragraph") {
      if (!textAlign && node.attrs.textAlign) textAlign = node.attrs.textAlign;
      if (!fontSize && node.attrs.fontSize) fontSize = node.attrs.fontSize;
    } else if (name === "bullet_list") {
      bulletList = true;
    } else if (name === "ordered_list") {
      orderedList = true;
    } else if (name === "blockquote") {
      blockquote = true;
    }
  }

  return { bold, italic, heading, bulletList, orderedList, blockquote, link, textAlign, fontSize };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FormattingToolbar() {
  const [loading, getEditor] = useInstance();
  const [active, setActive] = useState<ActiveState>(EMPTY_STATE);
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const fontSizeRef = useRef<HTMLDivElement>(null);

  // Poll active state on selection/content changes
  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;

    let frameId: number;
    let lastJson = "";

    function poll() {
      try {
        editor!.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const next = detectActiveState(view);
          const json = JSON.stringify(next);
          if (json !== lastJson) {
            lastJson = json;
            setActive(next);
          }
        });
      } catch {
        // editor might be destroyed
      }
      frameId = requestAnimationFrame(poll);
    }

    frameId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frameId);
  }, [loading, getEditor]);

  // Close heading menu on outside click
  useEffect(() => {
    if (!headingOpen) return;
    function handleClick(e: MouseEvent) {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) {
        setHeadingOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [headingOpen]);

  // Close font-size menu on outside click
  useEffect(() => {
    if (!fontSizeOpen) return;
    function handleClick(e: MouseEvent) {
      if (fontSizeRef.current && !fontSizeRef.current.contains(e.target as Node)) {
        setFontSizeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [fontSizeOpen]);

  // ---- Command helpers ----

  const exec = useCallback(
    (cmd: Parameters<typeof callCommand>[0], payload?: unknown) => {
      const editor = getEditor();
      if (!editor) return;
      editor.action(callCommand(cmd, payload));
    },
    [getEditor],
  );

  const setHeading = useCallback(
    (level: number) => {
      setHeadingOpen(false);
      const editor = getEditor();
      if (!editor) return;
      if (level === 0 || active.heading === level) {
        editor.action(callCommand(turnIntoTextCommand.key));
      } else {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state, dispatch } = view;
          const { $from, $to } = state.selection;
          const range = $from.blockRange($to);
          if (!range) return;
          const headingType = state.schema.nodes.heading;
          if (!headingType) return;
          const tr = state.tr.setBlockType(range.start, range.end, headingType, { level });
          dispatch(tr);
        });
      }
    },
    [getEditor, active.heading],
  );

  // Link: prompt for URL
  const handleLink = useCallback(() => {
    const editor = getEditor();
    if (!editor) return;

    if (active.link) {
      // Remove link — toggle off
      editor.action(callCommand(toggleLinkCommand.key, { href: "" }));
      return;
    }

    const href = prompt("URL del enlace:");
    if (!href) return;
    editor.action(callCommand(toggleLinkCommand.key, { href }));
  }, [getEditor, active.link]);

  // Drop cap: insert HTML span wrapping the first letter
  const handleDropCap = useCallback(() => {
    const editor = getEditor();
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state } = view;
      const { from, to } = state.selection;
      const selectedText = state.doc.textBetween(from, to, "");
      if (selectedText.length > 0) {
        // Wrap selection in dropcap span
        editor.action(insert(`<span class="dropcap">${selectedText}</span>`));
      } else {
        // Insert placeholder
        editor.action(insert(`<span class="dropcap">A</span>`));
      }
    });
  }, [getEditor]);

  // Text alignment: set textAlign attr on the current block node
  const setTextAlign = useCallback(
    (align: string | null) => {
      const editor = getEditor();
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state, dispatch } = view;
        const { $from, $to } = state.selection;

        // Apply to all block nodes in the selection range
        state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
          if (node.type.name === "paragraph" || node.type.name === "heading") {
            const newAlign = node.attrs.textAlign === align ? null : align;
            dispatch(
              state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                textAlign: newAlign,
              }),
            );
            return false; // don't descend
          }
          return true;
        });
      });
    },
    [getEditor],
  );

  // Font size: set fontSize attr on the current block node
  const setFontSize = useCallback(
    (size: FontSizeKey | null) => {
      setFontSizeOpen(false);
      const editor = getEditor();
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state, dispatch } = view;
        const { $from, $to } = state.selection;

        state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
          if (node.type.name === "paragraph" || node.type.name === "heading") {
            const newSize = node.attrs.fontSize === size ? null : size;
            dispatch(
              state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                fontSize: newSize,
              }),
            );
            return false;
          }
          return true;
        });
      });
    },
    [getEditor],
  );

  const disabled = loading;

  const headingLabels: Record<number, string> = {
    0: "¶",
    1: "H1",
    2: "H2",
    3: "H3",
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {/* Undo / Redo */}
      <ToolBtn title="Deshacer (Ctrl+Z)" onClick={() => exec(undoCommand.key)} disabled={disabled}>
        ↩
      </ToolBtn>
      <ToolBtn title="Rehacer (Ctrl+Shift+Z)" onClick={() => exec(redoCommand.key)} disabled={disabled}>
        ↪
      </ToolBtn>

      <Sep />

      {/* Bold / Italic */}
      <ToolBtn title="Negrita (Ctrl+B)" onClick={() => exec(toggleStrongCommand.key)} active={active.bold} disabled={disabled}>
        <b>B</b>
      </ToolBtn>
      <ToolBtn title="Cursiva (Ctrl+I)" onClick={() => exec(toggleEmphasisCommand.key)} active={active.italic} disabled={disabled}>
        <i>I</i>
      </ToolBtn>

      <Sep />

      {/* Heading dropdown */}
      <div ref={headingRef} className="relative">
        <ToolBtn
          title="Encabezado"
          onClick={() => setHeadingOpen(!headingOpen)}
          active={active.heading > 0}
          disabled={disabled}
          className="min-w-[2rem]"
        >
          {headingLabels[active.heading] ?? "¶"}
          <ChevronDown />
        </ToolBtn>
        {headingOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[7rem]">
            <HeadingOption label="Párrafo" tag="¶" onClick={() => setHeading(0)} active={active.heading === 0} />
            <HeadingOption label="Título 1" tag="H1" onClick={() => setHeading(1)} active={active.heading === 1} />
            <HeadingOption label="Título 2" tag="H2" onClick={() => setHeading(2)} active={active.heading === 2} />
            <HeadingOption label="Título 3" tag="H3" onClick={() => setHeading(3)} active={active.heading === 3} />
          </div>
        )}
      </div>

      <Sep />

      {/* Lists */}
      <ToolBtn title="Lista con viñetas" onClick={() => exec(wrapInBulletListCommand.key)} active={active.bulletList} disabled={disabled}>
        <SvgBulletList />
      </ToolBtn>
      <ToolBtn title="Lista numerada" onClick={() => exec(wrapInOrderedListCommand.key)} active={active.orderedList} disabled={disabled}>
        <SvgOrderedList />
      </ToolBtn>

      {/* Blockquote */}
      <ToolBtn title="Cita" onClick={() => exec(wrapInBlockquoteCommand.key)} active={active.blockquote} disabled={disabled}>
        <SvgBlockquote />
      </ToolBtn>

      <Sep />

      {/* Alignment */}
      <ToolBtn title="Alinear a la izquierda" onClick={() => setTextAlign("left")} active={active.textAlign === "left"} disabled={disabled}>
        <SvgAlignLeft />
      </ToolBtn>
      <ToolBtn title="Centrar" onClick={() => setTextAlign("center")} active={active.textAlign === "center"} disabled={disabled}>
        <SvgAlignCenter />
      </ToolBtn>
      <ToolBtn title="Alinear a la derecha" onClick={() => setTextAlign("right")} active={active.textAlign === "right"} disabled={disabled}>
        <SvgAlignRight />
      </ToolBtn>
      <ToolBtn title="Justificar" onClick={() => setTextAlign("justify")} active={active.textAlign === "justify"} disabled={disabled}>
        <SvgAlignJustify />
      </ToolBtn>

      <Sep />

      {/* Font size dropdown */}
      <div ref={fontSizeRef} className="relative">
        <ToolBtn
          title="Tamaño de texto"
          onClick={() => setFontSizeOpen(!fontSizeOpen)}
          active={active.fontSize != null}
          disabled={disabled}
          className="min-w-[2rem] text-[11px] font-mono"
        >
          {active.fontSize ? FONT_SIZE_LABELS[active.fontSize] : "M"}
          <ChevronDown />
        </ToolBtn>
        {fontSizeOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[7rem]">
            {(Object.keys(FONT_SIZE_MAP) as FontSizeKey[]).map((key) => (
              <HeadingOption
                key={key}
                label={FONT_SIZE_LABELS[key]}
                tag={FONT_SIZE_MAP[key] || "—"}
                onClick={() => setFontSize(key === "md" ? null : key)}
                active={active.fontSize === key || (key === "md" && active.fontSize == null)}
              />
            ))}
          </div>
        )}
      </div>

      <Sep />

      {/* Horizontal rule */}
      <ToolBtn title="Línea horizontal" onClick={() => exec(insertHrCommand.key)} disabled={disabled}>
        ―
      </ToolBtn>

      {/* Link */}
      <ToolBtn title="Enlace" onClick={handleLink} active={active.link} disabled={disabled}>
        <SvgLink />
      </ToolBtn>

      <Sep />

      {/* Drop cap */}
      <ToolBtn title="Capitular (drop cap)" onClick={handleDropCap} disabled={disabled}>
        <span className="font-serif text-[13px] leading-none">A</span>
      </ToolBtn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Sep() {
  return <span className="mx-0.5 h-4 w-px bg-stone-200 shrink-0" />;
}

interface ToolBtnProps {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function ToolBtn({ title, onClick, active, disabled, className = "", children }: ToolBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      className={`
        fmt-toolbar-btn
        ${active ? "fmt-toolbar-btn--active" : ""}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

function HeadingOption({ label, tag, onClick, active }: { label: string; tag: string; onClick: () => void; active: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-stone-50 transition-colors flex items-center justify-between gap-3 ${active ? "bg-stone-100 font-medium" : ""}`}
    >
      <span>{label}</span>
      <span className="text-stone-400 font-mono text-[10px]">{tag}</span>
    </button>
  );
}

function ChevronDown() {
  return (
    <svg className="w-2.5 h-2.5 ml-0.5 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SVG icons (14×14, stroke-based)
// ---------------------------------------------------------------------------

const iconClass = "w-3.5 h-3.5";
const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function SvgBulletList() {
  return (
    <svg className={iconClass} {...iconProps}>
      <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SvgOrderedList() {
  return (
    <svg className={iconClass} {...iconProps}>
      <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
      <text x="3" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text>
      <text x="3" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text>
      <text x="3" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text>
    </svg>
  );
}

function SvgBlockquote() {
  return (
    <svg className={iconClass} {...iconProps}>
      <line x1="6" y1="4" x2="6" y2="20" />
      <line x1="10" y1="8" x2="20" y2="8" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function SvgLink() {
  return (
    <svg className={iconClass} {...iconProps}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SvgAlignLeft() {
  return (
    <svg className={iconClass} {...iconProps}>
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="10" x2="15" y2="10" />
      <line x1="3" y1="14" x2="18" y2="14" /><line x1="3" y1="18" x2="12" y2="18" />
    </svg>
  );
}

function SvgAlignCenter() {
  return (
    <svg className={iconClass} {...iconProps}>
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="10" x2="18" y2="10" />
      <line x1="4" y1="14" x2="20" y2="14" /><line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  );
}

function SvgAlignRight() {
  return (
    <svg className={iconClass} {...iconProps}>
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="10" x2="21" y2="10" />
      <line x1="6" y1="14" x2="21" y2="14" /><line x1="12" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function SvgAlignJustify() {
  return (
    <svg className={iconClass} {...iconProps}>
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
