import { Check } from "lucide-react";
import { cardClass } from "@/components/ui/tokens";

export function StageCard({
  step,
  title,
  done,
  doneLabel,
  pendingHint,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  doneLabel: string;
  pendingHint?: string;
  children: React.ReactNode;
}) {
  if (done) {
    return (
      <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-emerald-500 bg-emerald-600 text-white shadow-[0_2px_10px_rgba(5,150,105,0.35)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-emerald-500/40 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700">
            <Check className="h-5 w-5" strokeWidth={2.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100">
              Etapa {step}
            </p>
            <p className="truncate text-sm font-bold uppercase tracking-tight">{doneLabel}</p>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-emerald-50/95 text-slate-900">
          {children}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`${cardClass} flex h-full min-h-0 flex-1 flex-col overflow-hidden border-amber-200/80`}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-amber-100 bg-amber-50/80 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-950">
          {step}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">
            Etapa {step} · em curso
          </p>
          <p className="truncate text-sm font-bold tracking-tight text-amber-950">{title}</p>
          {pendingHint ? (
            <p className="truncate text-[11px] text-amber-800/80">{pendingHint}</p>
          ) : null}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">{children}</div>
    </section>
  );
}
