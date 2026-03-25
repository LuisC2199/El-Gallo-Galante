// ---------------------------------------------------------------------------
// Admin – reusable unsaved-changes protection hook
// ---------------------------------------------------------------------------
//
// Provides:
//  1. `beforeunload` browser warning when dirty
//  2. `confirmNavigation()` – call before any in-app navigation; returns
//     true if safe to proceed, false if the user cancelled.
//
// Usage:
//   const { setDirty, confirmNavigation } = useUnsavedChanges();
//   // mark dirty on edits:   setDirty(true)
//   // reset after save:      setDirty(false)
//   // before switching item: if (!confirmNavigation()) return;
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

const CONFIRM_MSG = "You have unsaved changes. Discard them and continue?";

export interface UnsavedChangesControls {
  /** Whether there are unsaved changes. */
  dirty: boolean;
  /** Set or clear the dirty flag. */
  setDirty: (value: boolean) => void;
  /**
   * Call before any in-app navigation.
   * If dirty asks the user for confirmation via `window.confirm`.
   * Returns `true` if navigation should proceed, `false` to cancel.
   * Always returns `true` when not dirty.
   */
  confirmNavigation: () => boolean;
}

export function useUnsavedChanges(): UnsavedChangesControls {
  const [dirty, setDirty] = useState(false);

  // Keep a ref so the beforeunload handler always sees the latest value
  // without re-registering the listener on every render.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // ---- beforeunload (browser/tab close, refresh) ----
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      // Legacy browsers need returnValue set.
      e.returnValue = CONFIRM_MSG;
      return CONFIRM_MSG;
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // ---- in-app navigation guard ----
  const confirmNavigation = useCallback((): boolean => {
    if (!dirtyRef.current) return true;
    return window.confirm(CONFIRM_MSG);
  }, []);

  return { dirty, setDirty, confirmNavigation };
}
