"use client";

import { HelpCircle } from "lucide-react";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-700"
        aria-label={text}
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-left text-xs leading-snug text-slate-600 shadow-lg shadow-slate-900/10 group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}
