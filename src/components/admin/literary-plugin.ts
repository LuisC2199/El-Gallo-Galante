// ---------------------------------------------------------------------------
// Admin – ProseMirror plugin for literary block rendering
// ---------------------------------------------------------------------------
//
// Provides a custom NodeView for Milkdown's inline-atom `html` nodes.
// Literary HTML blocks are rendered as styled previews with format badges
// instead of raw monospace text.  Double-click opens an editing modal.
//
// Communication with the React layer uses a module-level callback set by
// MilkdownEditor via `setLiteraryEditCallback`.
// ---------------------------------------------------------------------------

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView as PMEditorViewFull } from "@milkdown/kit/prose/view";
import { detectLiteraryFormat, type LiteraryFormat } from "./literary-formats";

// ---------------------------------------------------------------------------
// Module-level callback for React communication
// ---------------------------------------------------------------------------

type EditCallback = (
  pos: number,
  html: string,
  format: LiteraryFormat,
) => void;

let onEditBlock: EditCallback | null = null;

export function setLiteraryEditCallback(cb: EditCallback | null) {
  onEditBlock = cb;
}

// ---------------------------------------------------------------------------
// NodeView
// ---------------------------------------------------------------------------

interface PMNode {
  type: { name: string };
  attrs: Record<string, unknown>;
  nodeSize: number;
}

class LiteraryNodeView {
  dom: HTMLElement;
  private node: PMNode;
  private view: PMEditorViewFull;
  private getPos: () => number | undefined;
  private badge: HTMLElement;
  private preview: HTMLElement;
  private editBtn: HTMLElement;
  private deleteBtn: HTMLElement;

  constructor(
    node: PMNode,
    view: PMEditorViewFull,
    getPos: () => number | undefined,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // Wrapper — uses <span display:block> because the node is inline
    this.dom = document.createElement("span");
    this.dom.style.display = "block";
    this.dom.contentEditable = "false";

    // Badge
    this.badge = document.createElement("span");
    this.badge.className = "literary-badge";
    this.dom.appendChild(this.badge);

    // Button container (top-right)
    const btnContainer = document.createElement("span");
    btnContainer.className = "literary-btn-group";
    this.dom.appendChild(btnContainer);

    // Edit button
    this.editBtn = document.createElement("button");
    this.editBtn.className = "literary-edit-btn";
    this.editBtn.textContent = "✎";
    this.editBtn.title = "Editar bloque";
    this.editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openEditor();
    });
    btnContainer.appendChild(this.editBtn);

    // Delete button
    this.deleteBtn = document.createElement("button");
    this.deleteBtn.className = "literary-delete-btn";
    this.deleteBtn.textContent = "✕";
    this.deleteBtn.title = "Eliminar bloque";
    this.deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.deleteNode();
    });
    btnContainer.appendChild(this.deleteBtn);

    // Preview
    this.preview = document.createElement("span");
    this.preview.className = "literary-preview";
    this.preview.style.display = "block";
    this.dom.appendChild(this.preview);

    this.render();

    // Double-click to edit
    this.dom.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openEditor();
    });
  }

  private openEditor() {
    const html = String(this.node.attrs.value ?? "");
    const format = detectLiteraryFormat(html);
    const pos = this.getPos();
    if (format && pos != null && format.fields.length > 0 && onEditBlock) {
      onEditBlock(pos, html, format);
    }
  }

  private deleteNode() {
    const pos = this.getPos();
    if (pos == null) return;
    const tr = this.view.state.tr.delete(pos, pos + this.node.nodeSize);
    this.view.dispatch(tr);
  }

  private render() {
    const html = String(this.node.attrs.value ?? "");
    const format = detectLiteraryFormat(html);

    this.dom.className = `literary-block ${format ? `literary-${format.id}` : "literary-generic"}`;

    this.badge.textContent = format?.label ?? "HTML";

    // Show/hide edit button based on whether format has editable fields
    this.editBtn.style.display =
      format && format.fields.length > 0 ? "" : "none";

    if (format) {
      this.preview.innerHTML = html;
      this.preview.classList.remove("literary-raw");
    } else {
      this.preview.textContent = html;
      this.preview.classList.add("literary-raw");
    }
  }

  update(node: PMNode): boolean {
    if (node.type.name !== this.node.type.name) return false;
    this.node = node;
    this.render();
    return true;
  }

  selectNode() {
    this.dom.classList.add("literary-selected");
  }

  deselectNode() {
    this.dom.classList.remove("literary-selected");
  }

  stopEvent(event: Event): boolean {
    // Allow keyboard deletion when node is selected
    if (event instanceof KeyboardEvent) {
      if (event.key === "Backspace" || event.key === "Delete") {
        return false; // let ProseMirror handle the deletion
      }
    }
    // Stop dblclick so ProseMirror doesn't try to expand selection
    return event.type === "dblclick" || event.type === "click";
  }

  ignoreMutation(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Milkdown plugin
// ---------------------------------------------------------------------------

export const literaryPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey("literary-blocks"),
    props: {
      nodeViews: {
        html: (
          node: PMNode,
          view: PMEditorViewFull,
          getPos: () => number | undefined,
        ) => new LiteraryNodeView(node, view, getPos),
      },
    },
  });
});
