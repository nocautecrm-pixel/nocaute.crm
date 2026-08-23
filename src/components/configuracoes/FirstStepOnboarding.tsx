"use client";

import { BadgeCheck, KeyRound, Smartphone } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { btnPrimaryClass, cardClass, eyebrowClass } from "@/components/ui/tokens";

const STEPS = [
  { icon: Smartphone, title: "Número da loja", hint: "O mesmo do atendimento." },
  { icon: KeyRound, title: "Login da Meta", hint: "Abre a conta oficial da loja." },
  { icon: BadgeCheck, title: "Dados na ferramenta", hint: "Número e nome vêm da Meta." },
] as const;

export function FirstStepOnboarding({
  connecting,
  connectLabel,
  connectDisabled,
  connected,
  onConnect,
}: {
  connecting: boolean;
  connectLabel: string;
  connectDisabled: boolean;
  connected: boolean;
  onConnect: () => void;
}) {
  return (
    <section className={`${cardClass} flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`${eyebrowClass} text-emerald-700`}>WhatsApp oficial</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
            Embedded Signup
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            connected
              ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
              : "border-amber-200/80 bg-amber-50/80 text-amber-800"
          }`}
        >
          <StatusDot tone={connected ? "live" : "pending"} />
          {connected ? "Conectado" : "One-click"}
        </span>
      </div>

      <ol className="mt-3 grid grid-cols-3 gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const done = connected || index === 0;
          const current = !connected && index === 1;
          return (
            <li
              key={step.title}
              className="rounded-lg border border-slate-200/70 bg-slate-50/60 px-2 py-2 text-center"
            >
              <span
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md border ${
                  done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : current
                      ? "border-emerald-300 bg-white text-emerald-700"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done && index !== 1 ? (
                  <span className="text-[10px] font-bold">✓</span>
                ) : (
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </span>
              <p className="mt-1.5 text-[11px] font-medium tracking-tight text-slate-900">{step.title}</p>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Use o número da loja, não um chip de teste. Depois do login, abra o WhatsApp do celular da
        casa: se as conversas sumirem, o número não está em coexistência na Meta.
      </p>

      <button
        type="button"
        onClick={onConnect}
        disabled={connectDisabled}
        className={`mt-auto w-full ${btnPrimaryClass}`}
      >
        {connecting ? "Conectando…" : connectLabel}
      </button>
    </section>
  );
}
