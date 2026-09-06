"use client";

import { useState, useTransition } from "react";
import type { PlanSlug } from "@/lib/billing/plans";
import type { AsaasBillingType } from "@/lib/billing/asaas-config";
import { btnPrimaryClass, btnSecondaryClass, cardClass, inputClass } from "@/components/ui/tokens";

type PlanCard = {
  slug: PlanSlug;
  name: string;
  priceCents: number;
  includedLeads: number;
};

type Props = {
  plans: PlanCard[];
  activeSlug: PlanSlug;
  billingConfigured: boolean;
  webhookHint: string;
};

export function PlanBillingPanel({
  plans,
  activeSlug,
  billingConfigured,
  webhookHint,
}: Props) {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [billingType, setBillingType] = useState<AsaasBillingType>("CREDIT_CARD");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function checkout(planSlug: PlanSlug) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planSlug, billingType, cpfCnpj }),
        });
        const data = (await res.json()) as {
          error?: string;
          invoiceUrl?: string | null;
          demo?: boolean;
          configured?: boolean;
        };
        if (!res.ok) {
          setMessage(data.error ?? "Não foi possível iniciar o pagamento.");
          return;
        }
        if (data.demo) {
          setMessage("Modo demo: checkout simulado (Asaas não chamado).");
          return;
        }
        if (data.invoiceUrl) {
          window.location.href = data.invoiceUrl;
          return;
        }
        setMessage(
          "Assinatura criada. Assim que o Asaas confirmar o pagamento, o plano libera automaticamente.",
        );
      } catch {
        setMessage("Falha de rede ao iniciar o checkout.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className={`${cardClass} space-y-3 p-4`}>
        <h3 className="text-sm font-semibold text-[#111B21]">Pagamento (Asaas)</h3>
        {billingConfigured ? (
          <p className="text-sm text-[#667781]">
            Cartão ou Pix. O servidor cria a assinatura; o plano só fica ativo depois do webhook
            de confirmação.
          </p>
        ) : (
          <p className="text-sm text-[#667781]">
            Estrutura pronta. Para ligar de verdade, preencha{" "}
            <code className="text-xs">ASAAS_API_KEY</code> e{" "}
            <code className="text-xs">ASAAS_WEBHOOK_TOKEN</code> no{" "}
            <code className="text-xs">.env.local</code> / Vercel, rode a migration{" "}
            <code className="text-xs">0018_asaas_billing</code> e cadastre o webhook:{" "}
            <code className="break-all text-xs">{webhookHint}</code>
          </p>
        )}

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-[#667781]">CPF ou CNPJ do pagador</span>
          <input
            className={inputClass}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Somente números"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            disabled={!billingConfigured || pending}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={billingType === "CREDIT_CARD" ? btnPrimaryClass : btnSecondaryClass}
            disabled={!billingConfigured || pending}
            onClick={() => setBillingType("CREDIT_CARD")}
          >
            Cartão
          </button>
          <button
            type="button"
            className={billingType === "PIX" ? btnPrimaryClass : btnSecondaryClass}
            disabled={!billingConfigured || pending}
            onClick={() => setBillingType("PIX")}
          >
            Pix
          </button>
        </div>

        {message ? <p className="text-sm text-[#111B21]">{message}</p> : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => {
          const active = plan.slug === activeSlug;
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
              <p className="mt-2 text-sm text-[#667781]">{plan.includedLeads} disparos/mês</p>
              {active ? (
                <p className="mt-3 text-xs font-semibold text-emerald-700">Plano atual</p>
              ) : null}
              <button
                type="button"
                className={`${btnPrimaryClass} mt-4 w-full`}
                disabled={!billingConfigured || pending || active}
                onClick={() => checkout(plan.slug)}
              >
                {active ? "Ativo" : pending ? "Aguarde…" : "Assinar"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
