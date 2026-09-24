"use client";

import { useState } from "react";
import { MessageSquarePlus, QrCode } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { btnPrimaryClass, cardClass, eyebrowClass } from "@/components/ui/tokens";
import type { WhatsAppOnboardingMode } from "@/lib/whatsapp/onboarding-mode";

/** Caminho validado: loja já atende no WhatsApp Business do celular (mesmo número, QR). */
const RECOMMENDED: WhatsAppOnboardingMode = "existing";

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
  const [mode, setMode] = useState<WhatsAppOnboardingMode>(RECOMMENDED);
  const [showNewPath, setShowNewPath] = useState(false);
  const canOpen = Boolean(mode) && !connectDisabled && !connecting;

  return (
    <section
      className={`${bare ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4" : `${cardClass} flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4`}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`${eyebrowClass} text-emerald-700`}>WhatsApp da Meta</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
            Ligar o número da loja
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
          {connected ? "Conectado" : "1 passo"}
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
        Abre a janela oficial da <span className="font-semibold text-slate-800">Meta</span>. O
        Nocaute só guarda o link — o WhatsApp continua da Meta.{" "}
        <span className="font-semibold text-slate-800">Não precisa comprar outro chip</span> se a
        loja já usa o WhatsApp Business no celular.
      </p>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`flex w-full gap-2.5 rounded-lg border px-2.5 py-2.5 text-left transition ${
            mode === "existing"
              ? "border-emerald-400 bg-emerald-50/90 ring-1 ring-emerald-300"
              : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300"
          }`}
        >
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
              mode === "existing"
                ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <QrCode className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-semibold tracking-tight text-slate-900">
                Já uso o WhatsApp Business no celular
              </span>
              <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                Recomendado
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
              Mesmo número da loja. No popup: Facebook → ligar app do celular (QR).
            </span>
            <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
              Não cria número Cloud novo · não deve pedir SMS
            </span>
          </span>
        </button>

        {showNewPath ? (
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex w-full gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
              mode === "new"
                ? "border-sky-400 bg-sky-50/90 ring-1 ring-sky-300"
                : "border-slate-200/70 bg-white hover:border-slate-300"
            }`}
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                mode === "new"
                  ? "border-sky-300 bg-sky-100 text-sky-800"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold tracking-tight text-slate-900">
                Número livre / novo na Cloud (SMS)
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
                Só se o número ainda não está no WhatsApp. Pode exigir chip diferente.
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                Se já atende no celular, volte para a opção recomendada (QR).
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowNewPath(true)}
            className="w-full rounded-lg border border-dashed border-slate-200 bg-transparent px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
          >
            Preciso de número novo na Cloud (avançado)…
          </button>
        )}
      </div>

      {mode === "existing" ? (
        <div className="mt-2 rounded-lg border border-amber-200/90 bg-amber-50/80 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
          <p className="font-semibold">No popup da Meta (ordem certa)</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-3.5 text-amber-900/90">
            <li>
              Entre com o <span className="font-semibold">Facebook da loja</span> (não outra conta
              do Chrome).
            </li>
            <li>
              Escolha ligar o <span className="font-semibold">WhatsApp Business do celular</span>{" "}
              (QR) — não “adicionar número”.
            </li>
            <li>
              Se pedir <span className="font-semibold">SMS</span>, está no caminho errado: feche e
              tente de novo.
            </li>
          </ol>
        </div>
      ) : null}

      {mode === "new" ? (
        <div className="mt-2 rounded-lg border border-sky-200/90 bg-sky-50/80 px-2.5 py-2 text-[11px] leading-snug text-sky-950">
          <p className="font-semibold">Número novo na Cloud</p>
          <p className="mt-0.5 text-sky-900/90">
            SMS é normal aqui. O número <span className="font-semibold">não pode</span> estar no
            WhatsApp pessoal/Business ao mesmo tempo. Se a loja já usa o app no celular, use a
            opção recomendada (mesmo número + QR) — não precisa comprar outro chip.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onConnect(mode)}
        disabled={!canOpen}
        className={`mt-3 w-full shrink-0 ${btnPrimaryClass}`}
      >
        {connecting
          ? "Abrindo a Meta…"
          : mode === "existing"
            ? connectLabel === "Abrir janela da Meta"
              ? "Abrir Meta e ligar com QR"
              : connectLabel
            : connectLabel}
      </button>
    </section>
  );
}
