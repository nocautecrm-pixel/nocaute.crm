import { Clock3, Radio, ShieldCheck, Smartphone } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { StatusDot } from "@/components/ui/StatusDot";
import { cardClass, eyebrowClass } from "@/components/ui/tokens";
import type { WhatsAppConnection } from "@/types/store";

function Metric({
  icon: Icon,
  label,
  value,
  tip,
  ok,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  tip: string;
  ok: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {label}
          <InfoTooltip text={tip} />
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-900">
          <StatusDot tone={ok ? "live" : "pending"} />
          {value}
        </p>
      </div>
    </div>
  );
}

export function ChannelStatusPanel({ connection }: { connection: WhatsAppConnection }) {
  const windowLabel = !connection.connected
    ? "Aguardando conexão"
    : connection.windowOpen
      ? `${connection.windowHoursLeft ?? 24}h restantes`
      : "Fechada";

  return (
    <section className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={eyebrowClass}>Status do canal</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
            Cloud API + janela 24h
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight ${
            connection.connected
              ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
              : "border-red-200/80 bg-red-50/80 text-red-600"
          }`}
        >
          <StatusDot tone={connection.connected ? "live" : "offline"} />
          {connection.connected ? "Conectado" : "Offline"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric
          icon={Radio}
          label="Cloud API"
          value={connection.connected ? connection.graphVersion : "—"}
          tip="Canal oficial da Meta. Campanhas e o bot saem por aqui, sem QR e sem extensão."
          ok={connection.connected}
        />
        <Metric
          icon={Clock3}
          label="Janela 24h"
          value={windowLabel}
          tip="Depois que o cliente responde, a Meta libera mensagem livre por 24h. Fora disso, só template aprovado."
          ok={connection.windowOpen}
        />
        <Metric
          icon={ShieldCheck}
          label="Qualidade"
          value={connection.qualityRating ?? (connection.connected ? "OK" : "—")}
          tip="Rating da WABA na Meta. Volume alto ou reclamação derruba o número."
          ok={connection.connected}
        />
        <Metric
          icon={Smartphone}
          label="Coexistência"
          value={connection.connected ? "Conferir no celular" : "—"}
          tip="A Cloud API só mantém o app do celular se o número estiver em coexistência na Meta. Não assuma: depois de conectar, abra o WhatsApp da loja e veja se as conversas continuam."
          ok={connection.connected}
        />
      </div>
    </section>
  );
}
