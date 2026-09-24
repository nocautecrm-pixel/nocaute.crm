"use client";

import { useState } from "react";
import { MessageSquarePlus, QrCode } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { btnPrimaryClass, cardClass, eyebrowClass } from "@/components/ui/tokens";
import type { WhatsAppOnboardingMode } from "@/lib/whatsapp/onboarding-mode";

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
  const canOpen = !connectDisabled && !connecting;

  return (
    <section
      className={`${bare ? "flex flex-1 flex-col justify-between gap-3 p-4" : `${cardClass} flex flex-1 flex-col justify-between gap-3 p-4`}`}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`${eyebrowClass} text-emerald-700`}>WhatsApp da loja</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
              Conectar em 1 clique
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
            {connected ? "Conectado" : "Pronto"}
          </span>
        </div>

        <p className="mt-2 text-[12px] leading-snug text-slate-600">
          Use o <span className="font-semibold text-slate-800">mesmo número</span> do celular.
          Sem chip novo. Sem complicação.
        </p>

        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex w-full gap-2.5 rounded-xl border px-3 py-3 text-left transition ${
              mode === "existing"
                ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300"
                : "border-slate-200 bg-slate-50/80 hover:border-slate-300"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                mode === "existing"
                  ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <QrCode className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-semibold text-slate-900">Já uso no celular</span>
                <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Ideal
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
                Mesmo número · ligar com QR na janela da Meta
              </span>
            </span>
          </button>

          {showNewPath ? (
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex w-full gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                mode === "new"
                  ? "border-sky-400 bg-sky-50 ring-1 ring-sky-300"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                  mode === "new"
                    ? "border-sky-300 bg-sky-100 text-sky-800"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <MessageSquarePlus className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-900">
                  Ainda não tenho WhatsApp
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
                  Cadastrar um número novo (a Meta pode pedir código)
                </span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewPath(true)}
              className="w-full px-1 text-left text-[11px] font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
            >
              Não uso WhatsApp no celular ainda?
            </button>
          )}
        </div>

        {mode === "existing" ? (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] leading-snug text-emerald-950">
            <p className="font-semibold">Na janela que abrir</p>
            <p className="mt-1 text-emerald-900/85">
              1) Facebook da loja · 2) Ligar o app do celular (QR) · 3) Se pedir SMS, feche e
              tente de novo
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-[11px] leading-snug text-sky-950">
            <p className="font-semibold">Número novo</p>
            <p className="mt-1 text-sky-900/85">
              Só se o número ainda não estiver no WhatsApp. Se já atende no celular, volte na
              opção Ideal.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onConnect(mode)}
        disabled={!canOpen}
        className={`w-full shrink-0 ${btnPrimaryClass}`}
      >
        {connecting
          ? "Abrindo…"
          : mode === "existing"
            ? connectLabel === "Abrir janela da Meta" || connectLabel === "Abrir Meta e ligar com QR"
              ? "Conectar WhatsApp da loja"
              : connectLabel
            : "Continuar na Meta"}
      </button>
    </section>
  );
}
