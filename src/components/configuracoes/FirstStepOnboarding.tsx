"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus, QrCode, UserRound } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { btnPrimaryClass, btnSecondaryClass, cardClass, eyebrowClass } from "@/components/ui/tokens";
import type { WhatsAppOnboardingMode } from "@/lib/whatsapp/onboarding-mode";
import type { MetaPortfolioHint } from "@/components/integracao/useEmbeddedSignup";

export function FirstStepOnboarding({
  connecting,
  metaBusy,
  connectLabel,
  connectDisabled,
  metaDisabled,
  metaLinked,
  metaName,
  portfolio,
  recommendedMode,
  connected,
  onLinkMeta,
  onConnect,
  bare = false,
}: {
  connecting: boolean;
  metaBusy: boolean;
  connectLabel: string;
  connectDisabled: boolean;
  metaDisabled: boolean;
  metaLinked: boolean;
  metaName: string | null;
  portfolio: MetaPortfolioHint | null;
  recommendedMode: WhatsAppOnboardingMode;
  connected: boolean;
  onLinkMeta: () => void;
  onConnect: (mode: WhatsAppOnboardingMode) => void;
  bare?: boolean;
}) {
  const [mode, setMode] = useState<WhatsAppOnboardingMode>(recommendedMode);

  useEffect(() => {
    setMode(recommendedMode);
  }, [recommendedMode]);

  const step = !metaLinked ? 1 : 2;

  return (
    <section
      className={`${bare ? "flex flex-1 flex-col justify-between gap-3 p-4" : `${cardClass} flex flex-1 flex-col justify-between gap-3 p-4`}`}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`${eyebrowClass} text-emerald-700`}>WhatsApp da loja</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
              {step === 1 ? "1 · Conta Meta" : "2 · WhatsApp"}
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              connected
                ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
                : metaLinked
                  ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
                  : "border-amber-200/80 bg-amber-50/80 text-amber-800"
            }`}
          >
            <StatusDot tone={connected || metaLinked ? "live" : "pending"} />
            {connected ? "Pronto" : metaLinked ? "Passo 2" : "Passo 1"}
          </span>
        </div>

        {!metaLinked ? (
          <>
            <p className="mt-2 text-[12px] leading-snug text-slate-600">
              Primeiro entre com o <span className="font-semibold text-slate-800">Facebook da loja</span>.
              Depois ligamos o WhatsApp do celular.
            </p>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
              <div className="flex gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                  <UserRound className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">Entrar com Meta</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                    Use a conta que gerencia a saladeria / restaurante — a mesma do celular da loja.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-[12px] leading-snug text-slate-600">
              Conta Meta{metaName ? `: ` : " conectada"}
              {metaName ? <span className="font-semibold text-slate-800">{metaName}</span> : null}.
              Agora ligue o WhatsApp.
            </p>

            {portfolio?.hasWhatsAppNumber && portfolio.displayPhone ? (
              <p className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/80 px-2.5 py-1.5 text-[11px] text-emerald-900">
                Achamos o número <span className="font-semibold">{portfolio.displayPhone}</span> na
                sua conta Meta. Use “Já uso no celular”.
              </p>
            ) : portfolio && !portfolio.limited && !portfolio.hasWhatsAppNumber ? (
              <p className="mt-2 rounded-lg border border-sky-100 bg-sky-50/80 px-2.5 py-1.5 text-[11px] text-sky-900">
                Ainda não vimos WhatsApp nessa conta. Se o número está só no celular, escolha “Já
                uso no celular”.
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                O número do celular da loja já tem WhatsApp?
              </p>
            )}

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
                    <span className="text-[13px] font-semibold text-slate-900">
                      Já uso no celular
                    </span>
                    <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Ideal
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">
                    Mesmo número · ligar com QR
                  </span>
                </span>
              </button>

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
                    Cadastrar número novo na Meta
                  </span>
                </span>
              </button>
            </div>

            {mode === "existing" ? (
              <p className="mt-3 text-[11px] leading-snug text-slate-500">
                Na janela: Facebook da loja → ligar app do celular (QR). Se pedir SMS, feche e
                tente de novo.
              </p>
            ) : (
              <p className="mt-3 text-[11px] leading-snug text-slate-500">
                Só se o número ainda não estiver no WhatsApp. Se já atende no celular, use a opção
                Ideal.
              </p>
            )}
          </>
        )}
      </div>

      {!metaLinked ? (
        <button
          type="button"
          onClick={onLinkMeta}
          disabled={metaDisabled}
          className={`w-full shrink-0 ${btnPrimaryClass}`}
        >
          {metaBusy ? "Abrindo Meta…" : "Entrar com Meta"}
        </button>
      ) : (
        <div className="flex w-full shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => onConnect(mode)}
            disabled={connectDisabled}
            className={`w-full ${btnPrimaryClass}`}
          >
            {connecting ? "Abrindo…" : connectLabel}
          </button>
          <button
            type="button"
            onClick={onLinkMeta}
            disabled={metaDisabled}
            className={`w-full ${btnSecondaryClass}`}
          >
            Trocar conta Meta
          </button>
        </div>
      )}
    </section>
  );
}
