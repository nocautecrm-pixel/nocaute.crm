"use client";

import { QrCode, Smartphone, Store } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { btnPrimaryClass, cardClass, eyebrowClass } from "@/components/ui/tokens";

const POPUP_STEPS = [
  {
    icon: Store,
    title: "1. Portfólio da loja",
    hint: "Escolhe o Business da casa (ex.: Com Limão e Sal).",
  },
  {
    icon: Smartphone,
    title: "2. Ligar o app do celular",
    hint: "Tem de aparecer “conectar WhatsApp Business existente / app”. Não escolhas “adicionar número” nem a WABA vazia antiga.",
  },
  {
    icon: QrCode,
    title: "3. QR no WhatsApp Business",
    hint: "O telemóvel mostra QR ou pedido no app. Não pedimos SMS para “criar” o número — ele já existe.",
  },
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
            Conectar a loja
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
          {connected ? "Conectado" : "Coexistência"}
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
        O Nocaute <span className="font-semibold text-slate-800">não cria</span> um WhatsApp novo:
        liga o que a loja já usa no celular à Cloud API (coexistência). Tudo no popup — sem abrir o
        Business Manager.
      </p>

      <ol className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {POPUP_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="flex gap-2.5 rounded-lg border border-slate-200/70 bg-slate-50/60 px-2.5 py-2"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold tracking-tight text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{step.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/70 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
        <p className="font-semibold">Se pedir SMS / “número já registado”</p>
        <p className="mt-0.5 text-amber-900/90">
          Estás no caminho errado (criar do zero). Fecha, clica de novo e procura a opção de{" "}
          <span className="font-semibold">app WhatsApp Business / QR</span>. SMS só serve para
          número que ainda não está no WhatsApp.
        </p>
      </div>

      <button
        type="button"
        onClick={onConnect}
        disabled={connectDisabled}
        className={`mt-3 w-full shrink-0 ${btnPrimaryClass}`}
      >
        {connecting ? "Abrindo a Meta…" : connectLabel}
      </button>
    </section>
  );
}
