import { Percent, TrendingUp, Users } from "lucide-react";
import { AdviceBoard } from "@/components/advisor/AdviceBoard";
import { StatusDot } from "@/components/ui/StatusDot";
import { cardClass, eyebrowClass } from "@/components/ui/tokens";
import { formatBRL } from "@/lib/demo/store";
import { getCampaignAdvice } from "@/server/advisor/gateway";
import { getRoiSummary } from "@/server/roi";
import { getStorePanel } from "@/server/store";

export default async function VisaoGeralPage() {
  const [store, roi] = await Promise.all([getStorePanel(), getRoiSummary()]);
  const advice = await getCampaignAdvice({ store, roi });
  const conversion = Math.min(store.kpis.couponConversionPct, 100);
  const liveStats = [
    { label: "Na fila", value: roi.queued, tone: "text-amber-600", dot: "pending" as const },
    { label: "Enviados", value: roi.sent, tone: "text-[#111B21]", dot: "idle" as const },
    { label: "Entregues", value: roi.delivered, tone: "text-emerald-600", dot: "live" as const },
    { label: "Falharam", value: roi.failed, tone: "text-red-600", dot: "offline" as const },
    { label: "Cupons gerados", value: roi.couponsIssued, tone: "text-[#111B21]", dot: "idle" as const },
    { label: "Cupons usados", value: roi.couponsRedeemed, tone: "text-emerald-600", dot: "live" as const },
  ];
  const checklistIncomplete =
    !store.storeName.trim() ||
    !store.menuUrl.trim() ||
    !store.hoursText.trim() ||
    !store.whatsapp.connected ||
    store.quota.included <= 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <AdviceBoard items={advice} />
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <article className={`${cardClass} flex flex-col justify-between p-4`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-[#667781]">Receita gerada no mês</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 text-[28px] font-bold tracking-tight text-emerald-600">
            {formatBRL(store.kpis.revenueMonth)}
          </p>
          <p className="mt-2 text-xs font-medium text-[#667781]">
            {store.kpis.revenueGrowthPct
              ? `+${store.kpis.revenueGrowthPct}% vs mês anterior`
              : "Sem histórico de receita ainda. O valor sobe quando o cupom for resgatado no caixa."}
          </p>
        </article>

        <article className={`${cardClass} flex flex-col justify-between p-4`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-[#667781]">Clientes reativados</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#667781]">
              <Users className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 text-[28px] font-bold tracking-tight text-[#111B21]">
            {store.kpis.reactivated30d}
          </p>
          <p className="mt-2 text-xs font-medium text-[#667781]">nos últimos 30 dias</p>
        </article>

        <article className={`${cardClass} flex flex-col justify-between p-4`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-[#667781]">Conversão dos cupons</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F2F5] text-[#667781]">
              <Percent className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 text-[28px] font-bold tracking-tight text-[#111B21]">
            {store.kpis.couponConversionPct.toString().replace(".", ",")}%
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#E9EDEF]">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${conversion}%` }} />
          </div>
        </article>
      </div>

      <section className={`${cardClass} grid shrink-0 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`}>
        {liveStats.map((card) => (
          <div
            key={card.label}
            className="border-b border-[#E9EDEF] px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <p className={`${eyebrowClass} flex items-center gap-1.5`}>
              <StatusDot tone={card.dot} />
              {card.label}
            </p>
            <p className={`mt-1.5 text-xl font-bold tracking-tight ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </section>

      {checklistIncomplete ? <PilotChecklist store={store} /> : null}
    </div>
  );
}

function PilotChecklist({ store }: { store: Awaited<ReturnType<typeof getStorePanel>> }) {
  const items = [
    { ok: Boolean(store.storeName.trim()), label: "Nome da loja preenchido" },
    { ok: Boolean(store.menuUrl.trim()), label: "Link do cardápio no perfil" },
    { ok: Boolean(store.hoursText.trim()), label: "Horário cadastrado no perfil da loja" },
    { ok: store.whatsapp.connected, label: "WhatsApp da casa conectado" },
    { ok: store.quota.included > 0, label: "Franquia de leads no ar (plano combinado)" },
  ];
  return (
    <section className={`${cardClass} p-4`}>
      <p className="text-sm font-semibold text-[#111B21]">Antes do primeiro disparo</p>
      <ul className="mt-3 space-y-2 text-sm text-[#667781]">
        {items.map((item) => (
          <li key={item.label}>
            {item.ok ? "✓" : "○"} {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[#667781]">
        Depois: 10–20 clientes com opt-in real → 1 campanha no seu celular → 1 cupom no caixa.
      </p>
    </section>
  );
}
