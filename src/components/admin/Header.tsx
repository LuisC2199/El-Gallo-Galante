// ---------------------------------------------------------------------------
// Admin – top header bar
// ---------------------------------------------------------------------------
import type React from "react";

export default function Header() {
  return (
    <header className="h-14 border-b border-stone-200 bg-white flex items-center px-6 shrink-0">
      <h1 className="text-base font-semibold tracking-tight text-stone-800">
        El Gallo Galante
        <span className="ml-2 text-xs font-normal text-stone-400">admin</span>
      </h1>
    </header>
  );
}
