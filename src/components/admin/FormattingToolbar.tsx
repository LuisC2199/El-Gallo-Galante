// ---------------------------------------------------------------------------
// Admin – Standard formatting toolbar for the Milkdown editor
// ---------------------------------------------------------------------------
//
// Word-like toolbar with bold, italic, headings, lists, blockquote, and
// undo/redo.  Tracks active marks/nodes to show pressed state.
// Must be rendered inside <MilkdownProvider>.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from "react";
import { useInstance } from "@milkdown/react";
import { editorViewCtx } from "@milkdown/kit/core";
import { callCommand } from "@milkdown/kit/utils";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { undoCommand, redoCommand } from "@milkdown/kit/plugin/history";

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
}

const EMPTY_STATE: ActiveState = {
  bold: false,
  italic: false,
  heading: 0,
  bulletList: false,
  orderedList: false,
  blockquote: false,
};

// ---------------------------------------------------------------------------
// Active state detection
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function detectActiveState(view: any): ActiveState {
  const { state } = view;
  const { $from } = state.selection;

  // Check marks (bold/italic)
  const marks: any[] = state.storedMarks ?? $from.marks();
  const bold = marks.some((m: any) => m.type.name === "strong");
  const italic = marks.some((m: any) => m.type.name === "emphasis");

  // Walk up node tree to detect heading, list, blockquote
  let heading = 0;
  let bulletList = false;
  let orderedList = false;
  let blockquote = false;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const name = node.type.name;
    if (name === "heading") {
      heading = node.attrs.level || 0;
    } else if (name === "bullet_list") {
      bulletList = true;
    } else if (name === "ordered_list") {
      orderedList = true;
    } else if (name === "blockquote") {
      blockquote = true;
    }
  }

  return { bold, italic, heading, bulletList, orderedList, blockquote };
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

  // Poll active state on selection/content changes
  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;

    let frameId: number;

    function poll() {
      try {
        editor!.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          setActive(detectActiveState(view));
        });
      } catch {
        // editor might be destroyed
      }
      frameId = requestAnimationFrame(poll);
    }

    // Start polling at a reasonable rate (tied to rAF, ~60fps but only
    // actually computes when needed since React batches identical states)
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
      if (active.heading === level) {
        // Toggle off → convert to paragraph
        editor.action(callCommand(turnIntoTextCommand.key));
      } else {
        // Milkdown's heading command: wrapInHeadingCommand needs import
        // Instead use the node command from commonmark
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

  const disabled = loading;

  const headingLabels: Record<number, string> = {
    0: "¶",
    1: "H1",
    2: "H2",
    3: "H3",
  };

  return (
    <div className="flex items-center gap-0.5">
      {/* Undo / Redo */}
      <ToolBtn
        title="Deshacer (Ctrl+Z)"
        onClick={() => exec(undoCommand.key)}
        disabled={disabled}
      >
        ↩
      </ToolBtn>
      <ToolBtn
        title="Rehacer (Ctrl+Shift+Z)"
        onClick={() => exec(redoCommand.key)}
        disabled={disabled}
      >
        ↪
      </ToolBtn>

      <Sep />

      {/* Bold / Italic */}
      <ToolBtn
        title="Negrita (Ctrl+B)"
        onClick={() => exec(toggleStrongCommand.key)}
        active={active.bold}
        disabled={disabled}
      >
        <b>B</b>
      </ToolBtn>
      <ToolBtn
        title="Cursiva (Ctrl+I)"
        onClick={() => exec(toggleEmphasisCommand.key)}
        active={active.italic}
        disabled={disabled}
      >
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
      <ToolBtn
        title="Lista con viñetas"
        onClick={() => exec(wrapInBulletListCommand.key)}
        active={active.bulletList}
        disabled={disabled}
      >
        ☰
      </ToolBtn>
      <ToolBtn
        title="Lista numerada"
        onClick={() => exec(wrapInOrderedListCommand.key)}
        active={active.orderedList}
        disabled={disabled}
      >
        1.
      </ToolBtn>

      {/* Blockquote */}
      <ToolBtn
        title="Cita"
        onClick={() => exec(wrapInBlockquoteCommand.key)}
        active={active.blockquote}
        disabled={disabled}
      >
        ❝
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
