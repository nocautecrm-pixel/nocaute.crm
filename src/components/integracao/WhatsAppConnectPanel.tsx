"use client";

import Script from "next/script";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FirstStepOnboarding } from "@/components/configuracoes/FirstStepOnboarding";
import { useEmbeddedSignup } from "@/components/integracao/useEmbeddedSignup";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  btnDangerClass,
  btnSecondaryClass,
  eyebrowClass,
  insetClass,
} from "@/components/ui/tokens";
import type { WhatsAppOnboardingMode } from "@/lib/whatsapp/onboarding-mode";
import { isWrongOnboardingPathError } from "@/lib/whatsapp/signup-errors";
import { formatWhatsAppPhone } from "@/lib/whatsapp/display";
import type { WhatsAppConnection } from "@/types/store";

export function WhatsAppConnectPanel({
  connection,
  onConnected,
  bare = false,
}: {
  connection: WhatsAppConnection;
  onConnected?: () => void;
  /** Sem card próprio — o StageCard envolve o bloco. */
  bare?: boolean;
}) {
  const router = useRouter();
  const [reconnectMode, setReconnectMode] = useState<WhatsAppOnboardingMode>("existing");
  const [showNewReconnect, setShowNewReconnect] = useState(false);
  const signup = useEmbeddedSignup(connection, () => {
    onConnected?.();
    router.refresh();
  });
  const wrongPath = isWrongOnboardingPathError(signup.error);

  function confirmDisconnect() {
    const ok = window.confirm(
      "Desligar o WhatsApp desta loja no Nocaute?\n\nO telemóvel continua com o WhatsApp Business. Só a ferramenta deixa de enviar campanhas até voltares a conectar.",
    );
    if (!ok) return;
    void signup.disconnect();
  }

  const shell = bare
    ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4"
    : "flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#E9EDEF] bg-white p-4 shadow-[0_1px_3px_rgba(11,20,26,0.08)]";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {signup.officialLoginReady ? (
        <Script
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
          onLoad={signup.initFacebookSdk}
        />
      ) : null}

      {signup.connected ? (
        <section className={shell}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={eyebrowClass}>WhatsApp da Meta</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
                Linkado com a Meta
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <StatusDot tone="live" />
              Conectado
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className={insetClass}>
              <dt className="text-xs font-medium text-slate-500">Número</dt>
              <dd className="mt-1 font-semibold tracking-tight text-slate-900">
                {formatWhatsAppPhone(signup.account.displayPhone) ??
                  signup.account.displayPhone ??
                  "Loja"}
              </dd>
            </div>
            <div className={insetClass}>
              <dt className="text-xs font-medium text-slate-500">Nome no WhatsApp</dt>
              <dd className="mt-1 truncate font-semibold tracking-tight text-slate-900">
                {signup.account.verifiedName ?? "—"}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Pode reconectar com o mesmo número do celular.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => setReconnectMode("existing")}
              className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold ${
                reconnectMode === "existing"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              Já uso no celular — ideal
            </button>
            {showNewReconnect ? (
              <button
                type="button"
                onClick={() => setReconnectMode("new")}
                className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold ${
                  reconnectMode === "new"
                    ? "border-sky-400 bg-sky-50 text-sky-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Ainda não tenho WhatsApp
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewReconnect(true)}
                className="px-1 text-left text-[11px] font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
              >
                Não uso WhatsApp no celular ainda?
              </button>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-3">
            <button
              type="button"
              onClick={() => {
                void signup.connect(reconnectMode);
              }}
              disabled={signup.connectDisabled}
              className={`${btnSecondaryClass} w-full`}
            >
              {signup.connectLabel}
            </button>
            <button
              type="button"
              onClick={confirmDisconnect}
              disabled={signup.disconnectDisabled}
              className={`${btnDangerClass} w-full`}
            >
              {signup.disconnecting ? "A desligar…" : "Desligar WhatsApp da ferramenta"}
            </button>
          </div>
        </section>
      ) : (
        <FirstStepOnboarding
          connecting={signup.busy}
          metaBusy={signup.metaBusy}
          connectLabel={signup.connectLabel}
          connectDisabled={signup.connectDisabled}
          metaDisabled={signup.metaDisabled}
          metaLinked={signup.metaLinked}
          metaName={signup.metaName}
          portfolio={signup.portfolio}
          recommendedMode={signup.recommendedMode}
          connected={false}
          onLinkMeta={() => {
            void signup.linkMeta();
          }}
          onConnect={(mode) => {
            void signup.connect(mode);
          }}
          bare={bare}
        />
      )}

      {signup.error ? (
        <div
          role="alert"
          className={`mt-2 rounded-lg border px-3 py-2 text-[12px] leading-snug ${
            signup.appReviewBlocked || wrongPath
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {signup.appReviewBlocked ? (
            <p className="mb-1 font-semibold tracking-tight">Conexão em liberação pela Meta</p>
          ) : null}
          {wrongPath && !signup.appReviewBlocked ? (
            <p className="mb-1 font-semibold tracking-tight">Quase lá — tente de novo com QR</p>
          ) : null}
          <p>{signup.error}</p>
        </div>
      ) : null}
    </div>
  );
}
