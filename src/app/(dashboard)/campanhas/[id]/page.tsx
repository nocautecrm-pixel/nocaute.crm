import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PauseResumeButtons } from "@/components/campaigns/PauseResumeButtons";
import { cardClass, eyebrowClass } from "@/components/ui/tokens";
import { RECENCY_SEGMENTS } from "@/lib/segments/recency";
import { getCampaign } from "@/server/campaigns";

export default async function CampanhaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <Link
        href="/resultados"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#667781] transition-all duration-150 hover:text-emerald-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Relatórios
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={eyebrowClass}>{RECENCY_SEGMENTS[campaign.segment].label}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {campaign.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">template {campaign.templateName}</p>
        </div>
        <PauseResumeButtons campaignId={campaign.id} status={campaign.status} />
      </div>
      <div className={`grid gap-3 ${cardClass} p-5 text-sm text-slate-600 md:grid-cols-2`}>
        <p>
          <strong className="font-semibold tracking-tight text-slate-900">
            Template MARKETING
          </strong>{" "}
          — <span className="font-mono text-slate-900">{campaign.templateName}</span> com o
          primeiro nome do cliente em {"{{1}}"} e botão URL &quot;{campaign.ctaLabel}&quot;.
        </p>
        <p>
          <strong className="font-semibold tracking-tight text-slate-900">
            Compliance
          </strong>{" "}
          — só clientes com opt-in comprovado (origem + comprovante). Limite Meta: 1 marketing /
          24h por número. Cupom rastreado:{" "}
          <span className="font-mono text-slate-900">{campaign.promoCode}</span>.
        </p>
      </div>
    </div>
  );
}
