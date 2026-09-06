"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { FirstStepOnboarding } from "@/components/configuracoes/FirstStepOnboarding";
import { useEmbeddedSignup } from "@/components/integracao/useEmbeddedSignup";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  btnDangerClass,
  btnSecondaryClass,
  cardClass,
  eyebrowClass,
  insetClass,
} from "@/components/ui/tokens";
import { formatWhatsAppPhone } from "@/lib/whatsapp/display";
import type { WhatsAppConnection } from "@/types/store";

export function WhatsAppConnectPanel({
  connection,
  onConnected,
}: {
  connection: WhatsAppConnection;
  onConnected?: () => void;
}) {
  const router = useRouter();
  const signup = useEmbeddedSignup(connection, () => {
    onConnected?.();
    router.refresh();
  });

  function confirmDisconnect() {
    const ok = window.confirm(
      "Desligar o WhatsApp desta loja no Nocaute?\n\nO telemóvel continua com o WhatsApp Business. Só a ferramenta deixa de enviar campanhas até voltares a conectar.",
    );
    if (!ok) return;
    void signup.disconnect();
  }

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
        <section className={`${cardClass} flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={eyebrowClass}>WhatsApp da loja</p>
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
            Número errado ou teste (+1 555)? Reconecta e no popup escolhe o WhatsApp Business do
            celular (QR), não “adicionar número novo”.
          </p>

          <div className="mt-auto flex flex-col gap-2 pt-3">
            <button
              type="button"
              onClick={signup.connect}
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
          connectLabel={signup.connectLabel}
          connectDisabled={signup.connectDisabled}
          connected={false}
          onConnect={signup.connect}
        />
      )}

      {signup.error ? <p className="mt-2 text-sm text-red-600">{signup.error}</p> : null}
    </div>
  );
}
