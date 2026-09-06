import { Check } from "lucide-react";

export function StageHud({
  step,
  title,
  done,
  doneLabel,
  pendingHint,
}: {
  step: number;
  title: string;
  done: boolean;
  doneLabel: string;
  pendingHint?: string;
}) {
  if (done) {
    return (
      <div className="mb-2 flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-600 px-3 py-2 text-white shadow-[0_1px_2px_rgba(5,150,105,0.25)]">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
            Etapa {step}
          </p>
          <p className="truncate text-xs font-bold tracking-tight">{doneLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 flex shrink-0 items-center gap-2 rounded-lg border border-[#E9EDEF] bg-[#F0F2F5] px-3 py-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#D1D7DB] bg-white text-[10px] font-bold text-[#667781]">
        {step}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#667781]">
          Em curso
        </p>
        <p className="truncate text-xs font-bold tracking-tight text-[#111B21]">{title}</p>
        {pendingHint ? (
          <p className="truncate text-[10px] text-[#667781]">{pendingHint}</p>
        ) : null}
      </div>
    </div>
  );
}
