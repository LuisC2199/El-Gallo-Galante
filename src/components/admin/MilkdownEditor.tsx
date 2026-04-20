// ---------------------------------------------------------------------------
// Admin – Milkdown Markdown editor wrapper
// ---------------------------------------------------------------------------
//
// Accepts a Markdown string and emits changes via onChange.
// Handles editor lifecycle when the parent remounts (post switching is
// handled by the parent keying this component on the slug).
// ---------------------------------------------------------------------------

import { useRef, useCallback, Component, type ReactNode } from "react";
import { Editor, defaultValueCtx, rootCtx, type KeymapItem } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { indent } from "@milkdown/kit/plugin/indent";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { $shortcut } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./milkdown.css";
import FormattingToolbar from "./FormattingToolbar";
import ImageInsertButton from "./ImageInsertButton";
import { textAlignPlugins } from "./text-align-plugin";
import { inlineSizePlugins } from "./inline-size-plugin";

// ---------------------------------------------------------------------------
// Heading-Enter → paragraph plugin
// ---------------------------------------------------------------------------
//
// ProseMirror's default `splitBlock` command honours `defining: true` on
// heading nodes: when the cursor is not at the very end of the heading it
// splits into **two headings** instead of a heading + paragraph.
//
// We register an Enter handler at priority 100 (above the base-keymap's 50)
// so it fires first and always forces the right-hand side of the split to be
// a plain paragraph.  Code blocks and list items are explicitly excluded so
// their own keymaps continue to handle Enter normally.
// ---------------------------------------------------------------------------
const enterAsParagraph = $shortcut(
  (_ctx) =>
    ({
      Enter: {
        key: "Enter",
        priority: 100, // runs before base-keymap (priority 50)
        onRun: (_ctx) => (state, dispatch) => {
          const { $from } = state.selection;
          const parent = $from.parent;

          // code blocks – newlineInCode handles these
          if (parent.type.spec.code === true) return false;

          // Only override for heading nodes; paragraphs, blockquotes,
          // list paragraphs, etc. all fall through to the base keymap.
          if (parent.type.name !== "heading") return false;

          const paragraphType = state.schema.nodes.paragraph;
          if (!paragraphType) return false;

          // When dispatch is absent ProseMirror is only probing whether the
          // command is applicable – confirm yes.
          if (!dispatch) return true;

          const tr = state.tr;
          // Remove any selected content first
          if (!state.selection.empty) tr.deleteSelection();
          const splitPos = tr.mapping.map($from.pos);
          // depth=1 → split the heading itself; typesAfter forces the new
          // right-side node to be a paragraph with default attrs.
          tr.split(splitPos, 1, [{ type: paragraphType }]);
          dispatch(tr.scrollIntoView());
          return true;
        },
      } as KeymapItem,
    } as Record<string, KeymapItem>),
);

// ---------------------------------------------------------------------------
// Inner component – must be inside MilkdownProvider
// ---------------------------------------------------------------------------

interface InnerProps {
  initialValue: string;
  onChange: (markdown: string) => void;
}

function MilkdownInner({ initialValue, onChange }: InnerProps) {
  // Keep a stable ref so the listener closure always calls the latest onChange.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          // Empty/whitespace-only Markdown (e.g. a brand-new post with no body)
          // produces an empty remark AST, which Milkdown converts to a ProseMirror
          // doc with zero block nodes. Zero blocks = no valid cursor positions =
          // the user cannot click to type. Use the JSON doc format to bypass
          // remark-parse and seed the editor with a proper empty paragraph instead.
          if (initialValue.trim()) {
            ctx.set(defaultValueCtx, initialValue);
          } else {
            ctx.set(defaultValueCtx, {
              type: "json",
              value: { type: "doc", content: [{ type: "paragraph" }] },
            });
          }

          // Wire up the markdown listener
          ctx
            .get(listenerCtx)
            .markdownUpdated((_ctx, markdown, prevMarkdown) => {
              if (markdown !== prevMarkdown) {
                onChangeRef.current(markdown);
              }
            });
        })
        .use(commonmark)
        .use(textAlignPlugins)
        .use(inlineSizePlugins)
        .use(listener)
        .use(history)
        .use(indent)
        .use(trailing)
        .use(enterAsParagraph),
    // Only recreate editor if the initial value identity changes
    // (parent should key this component on slug so it remounts entirely).
    [],
  );

  return <Milkdown />;
}

// ---------------------------------------------------------------------------
// Error boundary – catches Milkdown initialization / render failures
// ---------------------------------------------------------------------------

interface EBProps { children: ReactNode; }
interface EBState { error: string | null; }

class EditorErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : "Editor failed to load" };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded border border-red-200">
          Editor error: {this.state.error}
          <button
            onClick={() => this.setState({ error: null })}
            className="ml-3 text-xs underline text-red-500 hover:text-red-700"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Toolbar – needs to be inside MilkdownProvider
// ---------------------------------------------------------------------------

function Toolbar() {
  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 bg-stone-50 border-b border-stone-200 text-[11px]">
      <FormattingToolbar />
      <span className="mx-1 h-4 w-px bg-stone-200 shrink-0" />
      <ImageInsertButton />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface MilkdownEditorProps {
  /** Initial Markdown content to load into the editor. */
  value: string | null | undefined;
  /** Called whenever the Markdown content changes. */
  onChange: (markdown: string) => void;
}

export default function MilkdownEditor({ value, onChange }: MilkdownEditorProps) {
  // onChangeStable avoids re-rendering the provider when the parent
  // re-renders with a new onChange reference.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const stableOnChange = useCallback((md: string) => {
    onChangeRef.current(md);
  }, []);

  // Any null, undefined, or whitespace-only value (e.g. "\n\n" returned by
  // gray-matter for a brand-new file with no body) produces an empty ProseMirror
  // document with no block nodes, leaving the editor in a broken textarea-like
  // state. Normalizing to a single newline lets the trailing plugin and
  // ProseMirror's schema fill in a proper empty paragraph on initialization.
  const normalizedValue = value == null || !value.trim() ? "\n" : value;

  return (
    <EditorErrorBoundary>
      <div className="milkdown-wrapper rounded-lg border border-stone-200 bg-white overflow-hidden">
        <MilkdownProvider>
          <Toolbar />
          <MilkdownInner initialValue={normalizedValue} onChange={stableOnChange} />
        </MilkdownProvider>
      </div>
    </EditorErrorBoundary>
  );
}
