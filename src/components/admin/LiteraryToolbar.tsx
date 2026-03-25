// ---------------------------------------------------------------------------
// Admin – Literary formatting toolbar for the Milkdown editor
// ---------------------------------------------------------------------------
//
// Renders formatting buttons above the Milkdown editor.  Must be rendered
// inside <MilkdownProvider> so that useInstance() can access the editor.
// ---------------------------------------------------------------------------

import { useCallback } from "react";
import { useInstance } from "@milkdown/react";
import { editorViewCtx } from "@milkdown/kit/core";
import { insert } from "@milkdown/kit/utils";
import { LITERARY_FORMATS, type LiteraryFormat } from "./literary-formats";

// Group order for visual separation in the toolbar
const GROUP_ORDER = ["presentacion", "notas", "estructura", "formato"] as const;

export default function LiteraryToolbar() {
  const [loading, getEditor] = useInstance();

  const handleClick = useCallback(
    (format: LiteraryFormat) => {
      const editor = getEditor();
      if (!editor) return;

      // Read currently-selected text (synchronous action)
      let selectedText = "";
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { from, to } = view.state.selection;
        if (from !== to) {
          selectedText = view.state.doc.textBetween(from, to, "\n");
        }
      });

      // Build the HTML block from template
      const html = format.template(selectedText || format.placeholder);

      // Insert the HTML block at the cursor / replace selection.
      // Wrap with blank lines so the markdown parser recognises it as
      // a standalone HTML block.
      editor.action(insert(`\n\n${html}\n\n`));
    },
    [getEditor],
  );

  // Group formats
  const groups = GROUP_ORDER.map((g) => ({
    key: g,
    formats: LITERARY_FORMATS.filter((f) => f.group === g),
  }));

  return (
    <>
      {groups.map((group, gi) => (
        <div key={group.key} className="flex items-center gap-0.5">
          {gi > 0 && (
            <span className="mx-1 h-4 w-px bg-stone-200 shrink-0" />
          )}
          {group.formats.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => handleClick(format)}
              disabled={loading}
              title={format.title}
              className="px-2 py-1 rounded text-stone-600 hover:bg-stone-200 hover:text-stone-800 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {format.label}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}
