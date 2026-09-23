"use client";

import { useState } from "react";
import { MessageSquarePlus, QrCode } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { btnPrimaryClass, cardClass, eyebrowClass } from "@/components/ui/tokens";
import type { WhatsAppOnboardingMode } from "@/lib/whatsapp/onboarding-mode";

const PATHS: Array<{
  id: WhatsAppOnboardingMode;
  title: string;
  hint: string;
  detail: string;
  icon: typeof QrCode;
}> = [
  {
    id: "existing",
    title: "Já uso o WhatsApp da Meta no celular",
    hint: "Ligar o número que a loja já usa (QR no WhatsApp Business).",
    detail: "Não cria número novo. Não deve pedir SMS.",
    icon: QrCode,
  },
  {
    id: "new",
    title: "Ainda não tenho número na Meta",
    hint: "Cadastrar um número novo no WhatsApp oficial da Meta.",
    detail: "A Meta pode pedir SMS ou ligação para confirmar o número.",
    icon: MessageSquarePlus,
  },
];

export function FirstStepOnboarding({
  connecting,
  connectLabel,
  connectDisabled,
  connected,
  onConnect,
  bare = false,
}: {
  connecting: boolean;
  connectLabel: string;
  connectDisabled: boolean;
  connected: boolean;
  onConnect: (mode: WhatsAppOnboardingMode) => void;
  bare?: boolean;
}) {
  const [mode, setMode] = useState<WhatsAppOnboardingMode | null>(null);
  const canOpen = Boolean(mode) && !connectDisabled && !connecting;

  return (
    <section
      className={`${bare ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4" : `${cardClass} flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4`}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`${eyebrowClass} text-emerald-700`}>WhatsApp da Meta</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
            Como quer conectar?
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
          {connected ? "Conectado" : "Escolha 1 opção"}
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
        Isto abre a janela oficial da <span className="font-semibold text-slate-800">Meta</span>. O
        Nocaute só guarda o link da loja — o WhatsApp continua sendo da Meta.
      </p>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {PATHS.map((path) => {
          const Icon = path.icon;
          const selected = mode === path.id;
          return (
            <button
              key={path.id}
              type="button"
              onClick={() => setMode(path.id)}
              className={`flex w-full gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                selected
                  ? "border-emerald-400 bg-emerald-50/90 ring-1 ring-emerald-300"
                  : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                  selected
                    ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold tracking-tight text-slate-900">
                  {path.title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
                  {path.hint}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                  {path.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === "existing" ? (
        <div className="mt-2 rounded-lg border border-amber-200/90 bg-amber-50/80 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
          <p className="font-semibold">No popup da Meta</p>
          <p className="mt-0.5 text-amber-900/90">
            Escolha ligar o <span className="font-semibold">WhatsApp Business do celular</span> (QR).
            Se pedir SMS, está no caminho errado — volte e use esta opção de novo com cuidado.
          </p>
        </div>
      ) : null}

      {mode === "new" ? (
        <div className="mt-2 rounded-lg border border-sky-200/90 bg-sky-50/80 px-2.5 py-2 text-[11px] leading-snug text-sky-950">
          <p className="font-semibold">Número novo na Meta</p>
          <p className="mt-0.5 text-sky-900/90">
            SMS é normal neste caminho. Se o número <span className="font-semibold">já está</span> no
            WhatsApp Business do celular, use a outra opção (QR).
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (!mode) return;
          onConnect(mode);
        }}
        disabled={!canOpen}
        className={`mt-3 w-full shrink-0 ${btnPrimaryClass}`}
      >
        {connecting
          ? "Abrindo a Meta…"
          : !mode
            ? "Escolha uma opção acima"
            : connectLabel}
      </button>
    </section>
  );
}
