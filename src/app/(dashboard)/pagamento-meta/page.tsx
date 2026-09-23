import Link from "next/link";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { StatusDot } from "@/components/ui/StatusDot";
import { cardClass, eyebrowClass } from "@/components/ui/tokens";
import { getStorePanel } from "@/server/store";
import { getCurrentRestaurantId } from "@/server/tenant";
import {
  getMetaWabaBillingSnapshot,
  type MetaWabaBillingStatus,
} from "@/server/whatsapp-billing";

const META_BILLING_HELP =
  "https://www.facebook.com/business/help/488291839463771";

function statusUi(status: MetaWabaBillingStatus): {
  label: string;
  tone: "live" | "pending" | "offline" | "idle";
  pill: string;
} {
  switch (status) {
    case "connected":
      return {
        label: "Cartão / método ligado",
        tone: "live",
        pill: "border-emerald-200 bg-emerald-50 text-emerald-800",
      };
    case "missing":
      return {
        label: "Falta cartão na Meta",
        tone: "pending",
        pill: "border-amber-200 bg-amber-50 text-amber-900",
      };
    case "not_linked":
      return {
        label: "WhatsApp ainda não linkado",
        tone: "offline",
        pill: "border-rose-200 bg-rose-50 text-rose-800",
      };
    default:
      return {
        label: "Conferir na Meta",
        tone: "idle",
        pill: "border-slate-200 bg-slate-50 text-slate-600",
      };
  }
}

export default async function PagamentoMetaPage() {
  const store = await getStorePanel();
  const restaurantId = await getCurrentRestaurantId();
  const billing = await getMetaWabaBillingSnapshot(restaurantId);
  const connected = store.whatsapp.connected;
  const phone = store.whatsapp.displayPhone;
  const ui = statusUi(billing.status);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-2">
      <header>
        <p className={eyebrowClass}>WhatsApp da Meta</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
          Pagamento das mensagens (Meta)
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Aqui é o cartão que a <span className="font-semibold text-slate-800">Meta</span> usa para
          cobrar os envios de WhatsApp da loja.{" "}
          <span className="font-semibold text-slate-800">Não é</span> a mensalidade do Nocaute.
        </p>
      </header>

      <section className={`${cardClass} p-4`}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
            <CreditCard className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              O que o lojista precisa saber
            </h2>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-slate-600">
              <li>
                • Campanhas e templates oficiais geram cobrança da{" "}
                <span className="font-medium text-slate-800">Meta</span>, no cartão da conta
                WhatsApp Business.
              </li>
              <li>
                • O Nocaute <span className="font-medium text-slate-800">não guarda</span> o número do
                cartão. O cadastro é feito na própria Meta.
              </li>
              <li>
                • A mensalidade da ferramenta (CRM) fica em{" "}
                <Link
                  href="/plano"
                  className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
                >
                  Plano
                </Link>
                .
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className={`${cardClass} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={eyebrowClass}>Status nesta loja</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
              Cartão na conta WhatsApp (Meta)
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ui.pill}`}
          >
            <StatusDot tone={ui.tone} />
            {ui.label}
          </span>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{billing.detail}</p>

        {connected && phone ? (
          <p className="mt-2 text-[12px] text-slate-500">
            Número linkado no Nocaute:{" "}
            <span className="font-semibold text-slate-700">{phone}</span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {billing.status === "not_linked" ? (
            <Link
              href="/configuracoes"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Ir conectar WhatsApp da Meta
            </Link>
          ) : (
            <a
              href={META_BILLING_HELP}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              {billing.status === "connected"
                ? "Gerenciar pagamento na Meta"
                : "Cadastrar / conferir cartão na Meta"}
              <ExternalLink className="h-4 w-4" strokeWidth={2} />
            </a>
          )}
          <Link
            href="/plano"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Plano do Nocaute (CRM)
          </Link>
        </div>
      </section>

      <section className={`${cardClass} flex items-start gap-3 p-4`}>
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <p className="text-[12px] leading-relaxed text-slate-500">
          O status acima vem da consulta oficial à conta WhatsApp na Meta (
          <span className="font-medium">primary_funding_id</span>). O Nocaute nunca vê nem guarda os
          dados do cartão — só se existe método de pagamento ligado.
        </p>
      </section>
    </div>
  );
}
