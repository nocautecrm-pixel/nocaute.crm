import Link from "next/link";
import { PauseResumeButtons } from "@/components/campaigns/PauseResumeButtons";
import { StatusDot } from "@/components/ui/StatusDot";
import { cardClass } from "@/components/ui/tokens";
import { campaignStatusLabel } from "@/lib/demo/store";
import { RECENCY_SEGMENTS } from "@/lib/segments/recency";
import { listCampaigns } from "@/server/campaigns";

const FILTERS = [
  { id: "todas", label: "Todas" },
  { id: "ativas", label: "Ativas" },
  { id: "agendadas", label: "Agendadas" },
  { id: "pausadas", label: "Pausadas" },
  { id: "encerradas", label: "Encerradas" },
] as const;

function matchesFilter(status: string, filter: string) {
  if (filter === "ativas") return status === "running" || status === "queued";
  if (filter === "agendadas") return status === "scheduled";
  if (filter === "pausadas") return status === "paused";
  if (filter === "encerradas") return status === "done" || status === "failed";
  return true;
}

function campaignTone(status: string): "live" | "pending" | "offline" | "idle" {
  if (status === "paused" || status === "scheduled") return "pending";
  if (status === "failed") return "offline";
  if (status === "done") return "idle";
  return "live";
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const filter = FILTERS.some((item) => item.id === params.status) ? params.status! : "todas";
  const campaigns = (await listCampaigns()).filter((campaign) =>
    matchesFilter(campaign.status, filter),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-[#E9EDEF] pb-px">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <Link
              key={item.id}
              href={item.id === "todas" ? "/resultados" : `/resultados?status=${item.id}`}
              className={`px-3 py-2 text-sm tracking-tight ${
                active
                  ? "border-b-2 border-emerald-600 font-semibold text-[#111B21]"
                  : "font-medium text-[#667781] hover:text-[#111B21]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {campaigns.length === 0 ? (
          <div className={`${cardClass} px-5 py-10 text-center text-sm text-[#667781]`}>
            Nenhuma campanha neste filtro.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`flex items-center justify-between gap-3 ${cardClass} px-4 py-3`}
              >
                <Link href={`/campanhas/${campaign.id}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold tracking-tight text-[#111B21]">
                    <StatusDot tone={campaignTone(campaign.status)} />
                    <span className="truncate">{campaign.name}</span>
                  </p>
                  <p className="mt-0.5 truncate text-sm text-[#667781]">
                    {campaignStatusLabel(campaign.status)}
                    {campaign.startsAt
                      ? ` · ${new Date(campaign.startsAt).toLocaleString("pt-BR")}`
                      : ""}
                    {" · "}
                    {RECENCY_SEGMENTS[campaign.segment].label}
                  </p>
                </Link>
                <PauseResumeButtons campaignId={campaign.id} status={campaign.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
