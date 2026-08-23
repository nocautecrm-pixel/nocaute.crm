import { PLANS } from "@/lib/billing/plans";
import { cardClass } from "@/components/ui/tokens";
import { getStorePanel } from "@/server/store";

export default async function PlanoPage() {
  const store = await getStorePanel();
  const quota = store.quota;

  return (
    <div className="space-y-4">
      <section className={`${cardClass} p-4`}>
        <h2 className="text-base font-semibold text-[#111B21]">Franquia deste mês</h2>
        <p className="mt-1 text-sm text-[#667781]">
          Isso limita disparo pela ferramenta. O WhatsApp da Meta não cobra lead por aqui. Ainda
          não há Stripe, Asaas nem boleto no app — o piloto combina valor no WhatsApp.
        </p>
        <p className="mt-4 text-2xl font-bold text-[#111B21]">
          {quota.planName} · {quota.used}/{quota.included} leads
        </p>
        <p className="mt-1 text-sm text-[#667781]">
          Restam {quota.remaining}. Extra: {quota.extra}.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const active = plan.slug === quota.planSlug;
          return (
            <article
              key={plan.slug}
              className={`${cardClass} p-4 ${active ? "ring-2 ring-emerald-600" : ""}`}
            >
              <p className="text-sm font-semibold text-[#111B21]">{plan.name}</p>
              <p className="mt-1 text-lg font-bold text-[#111B21]">
                R$ {(plan.priceCents / 100).toFixed(0)}
                <span className="text-sm font-medium text-[#667781]">/mês</span>
              </p>
              <p className="mt-2 text-sm text-[#667781]">{plan.includedLeads} leads inclusos</p>
              {active ? (
                <p className="mt-3 text-xs font-semibold text-emerald-700">Plano atual (piloto)</p>
              ) : (
                <p className="mt-3 text-xs text-[#667781]">Upgrade combinado fora do app, por enquanto.</p>
              )}
            </article>
          );
        })}
      </div>

      <a
        href="/api/store/export"
        className="inline-flex h-10 items-center rounded-lg border border-[#E9EDEF] bg-white px-4 text-sm font-semibold text-[#111B21]"
      >
        Exportar dados da loja (JSON)
      </a>
    </div>
  );
}
