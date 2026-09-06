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
      <div className="mb-2 flex shrink-0 items-center gap-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-600 px-3 py-2.5 text-white shadow-[0_2px_8px_rgba(5,150,105,0.35)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700">
          <Check className="h-5 w-5" strokeWidth={2.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-100">
            Etapa {step} · concluída
          </p>
          <p className="truncate text-sm font-bold tracking-tight uppercase">{doneLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 flex shrink-0 items-center gap-2.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-900">
        {step}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800">
          Etapa {step} · em curso
        </p>
        <p className="truncate text-sm font-bold tracking-tight text-amber-950">{title}</p>
        {pendingHint ? (
          <p className="truncate text-[11px] text-amber-800/80">{pendingHint}</p>
        ) : null}
      </div>
    </div>
  );
}
