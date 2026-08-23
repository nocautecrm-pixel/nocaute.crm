"use client";

import { previewConversation, type BrandDna } from "@/lib/chatbot/dna";

export function PersonalityPreview({
  dna,
  storeName,
  facts,
}: {
  dna: BrandDna;
  storeName: string;
  facts?: { hoursText?: string; menuUrl?: string; address?: string };
}) {
  const turns = previewConversation(dna, storeName, facts);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200/80 bg-slate-900 p-4 text-white shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300">
          Preview ao vivo
        </p>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
          Motor DNA
        </span>
      </div>

      <div className="mt-3 flex-1 space-y-3 overflow-hidden">
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-1.5">
            <p className="ml-8 rounded-2xl rounded-tr-sm bg-white/10 px-3 py-2 text-xs leading-snug text-slate-100">
              {turn.customer}
            </p>
            <p className="mr-6 rounded-2xl rounded-tl-sm bg-emerald-500/90 px-3 py-2 text-xs leading-snug text-white">
              {turn.bot}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
