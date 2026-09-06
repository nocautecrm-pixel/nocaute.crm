import { PLANS } from "@/lib/billing/plans";
import { asaasWebhookUrl, isAsaasConfigured } from "@/lib/billing/asaas-config";
import { getAppUrl } from "@/lib/config";
import { PlanBillingPanel } from "@/components/plano/PlanBillingPanel";
import { cardClass } from "@/components/ui/tokens";
import { getStorePanel } from "@/server/store";

export default async function PlanoPage() {
  const store = await getStorePanel();
  const quota = store.quota;
  const billingConfigured = isAsaasConfigured();

  return (
    <div className="space-y-4">
      <section className={`${cardClass} p-4`}>
        <h2 className="text-base font-semibold text-[#111B21]">Franquia deste mês</h2>
        <p className="mt-1 text-sm text-[#667781]">
          Isso limita disparo pela ferramenta. O WhatsApp da Meta não cobra lead por aqui.
          Cobrança da mensalidade via Asaas (cartão ou Pix) — o plano só muda no servidor após
          confirmação do pagamento.
        </p>
        <p className="mt-4 text-2xl font-bold text-[#111B21]">
          {quota.planName} · {quota.used}/{quota.included} disparos
        </p>
        <p className="mt-1 text-sm text-[#667781]">
          Restam {quota.remaining}. Extra: {quota.extra}.
        </p>
      </section>

      <PlanBillingPanel
        plans={[...PLANS]}
        activeSlug={quota.planSlug}
        billingConfigured={billingConfigured}
        webhookHint={asaasWebhookUrl(getAppUrl())}
      />

      <a
        href="/api/store/export"
        className="inline-flex h-10 items-center rounded-lg border border-[#E9EDEF] bg-white px-4 text-sm font-semibold text-[#111B21]"
      >
        Exportar dados da loja (JSON)
      </a>
    </div>
  );
}
