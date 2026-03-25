// ---------------------------------------------------------------------------
// Admin – Literary formatting toolbar for the Milkdown editor
// ---------------------------------------------------------------------------
//
// Dropdown-based toolbar grouped by category.  Must be rendered inside
// <MilkdownProvider> so that useInstance() can access the editor.
// ---------------------------------------------------------------------------

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { useInstance } from "@milkdown/react";
import { editorViewCtx } from "@milkdown/kit/core";
import { insert } from "@milkdown/kit/utils";
import {
  getGroupedFormats,
  type LiteraryFormat,
  type LiteraryGroup,
} from "./literary-formats";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Called when a format with editable fields is selected. */
  onEditRequest: (
    format: LiteraryFormat,
    values: Record<string, string>,
  ) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LiteraryToolbar({ onEditRequest }: Props) {
  const [loading, getEditor] = useInstance();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const groups = getGroupedFormats();

  /** Read currently-selected text from the editor. */
  const getSelectedText = useCallback((): string => {
    const editor = getEditor();
    if (!editor) return "";
    let text = "";
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, to } = view.state.selection;
      if (from !== to) {
        text = view.state.doc.textBetween(from, to, "\n");
      }
    });
    return text;
  }, [getEditor]);

  /** Handle a format item selection from a dropdown. */
  const handleSelect = useCallback(
    (format: LiteraryFormat) => {
      setOpenMenu(null);

      // Formats with no fields (e.g. separator) → insert directly
      if (format.fields.length === 0) {
        const editor = getEditor();
        if (editor) {
          editor.action(insert(`\n\n${format.template({})}\n\n`));
        }
        return;
      }

      // Pre-fill default values; put any selected text in the first field
      const selectedText = getSelectedText();
      const values: Record<string, string> = {};
      format.fields.forEach((field, i) => {
        values[field.key] =
          i === 0 && selectedText ? selectedText : field.default;
      });

      onEditRequest(format, values);
    },
    [getEditor, getSelectedText, onEditRequest],
  );

  return (
    <div className="flex items-center gap-0.5 relative">
      {groups.map(({ group, formats }, gi) => (
        <Fragment key={group.id}>
          {gi > 0 && (
            <span className="mx-0.5 h-4 w-px bg-stone-200 shrink-0" />
          )}
          <DropdownMenu
            group={group}
            formats={formats}
            isOpen={openMenu === group.id}
            onToggle={() =>
              setOpenMenu(openMenu === group.id ? null : group.id)
            }
            onClose={() => setOpenMenu(null)}
            onSelect={handleSelect}
            disabled={loading}
          />
        </Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown menu
// ---------------------------------------------------------------------------

interface DropdownProps {
  group: LiteraryGroup;
  formats: LiteraryFormat[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (format: LiteraryFormat) => void;
  disabled: boolean;
}

function DropdownMenu({
  group,
  formats,
  isOpen,
  onToggle,
  onClose,
  onSelect,
  disabled,
}: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium
          transition-colors whitespace-nowrap select-none
          ${
            isOpen
              ? "bg-stone-200 text-stone-800"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
          }
          disabled:opacity-40
        `}
      >
        <span className="opacity-60">{group.icon}</span>
        {group.label}
        <Chevron open={isOpen} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[210px] bg-white border border-stone-200 rounded-lg shadow-lg py-1 animate-fade-in">
          {formats.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => onSelect(format)}
              className="w-full text-left px-3 py-2 hover:bg-stone-50 transition-colors flex items-start gap-2.5"
            >
              <span className="text-stone-400 text-sm w-5 text-center shrink-0 pt-px">
                {format.icon}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] text-stone-700 leading-snug">
                  {format.label}
                </div>
                <div className="text-[11px] text-stone-400 leading-tight mt-0.5">
                  {format.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny chevron icon
// ---------------------------------------------------------------------------

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}
