// ---------------------------------------------------------------------------
// Admin – Milkdown Markdown editor wrapper
// ---------------------------------------------------------------------------
//
// Accepts a Markdown string and emits changes via onChange.
// Handles editor lifecycle when the parent remounts (post switching is
// handled by the parent keying this component on the slug).
// ---------------------------------------------------------------------------

import { useRef, useCallback, Component, type ReactNode } from "react";
import { Editor, defaultValueCtx, rootCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { indent } from "@milkdown/kit/plugin/indent";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./milkdown.css";
import FormattingToolbar from "./FormattingToolbar";
import ImageInsertButton from "./ImageInsertButton";
import { textAlignPlugins } from "./text-align-plugin";

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
          ctx.set(defaultValueCtx, initialValue);

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
        .use(listener)
        .use(history)
        .use(indent)
        .use(trailing),
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
  value: string;
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

  return (
    <EditorErrorBoundary>
      <div className="milkdown-wrapper rounded-lg border border-stone-200 bg-white overflow-hidden">
        <MilkdownProvider>
          <Toolbar />
          <MilkdownInner initialValue={value} onChange={stableOnChange} />
        </MilkdownProvider>
      </div>
    </EditorErrorBoundary>
  );
}
