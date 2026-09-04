import { hasProvenOptIn } from "@/lib/customers/opt-in";
import { adviceById, rankAdvice } from "@/lib/advisor/playbooks";
import type { AdvisorSnapshot } from "@/lib/advisor/types";
import { LEGACY_HEAT_AUDIENCE_SLUGS } from "@/lib/audiences/defaults";
import type { RoiSummary } from "@/types/database";
import type { StorePanel } from "@/types/store";
import { listAudiences } from "@/server/audiences";
import { getRoiSummary } from "@/server/roi";
import { listCampaigns } from "@/server/campaigns";
import { listCustomers } from "@/server/customers";
import { getStorePanel } from "@/server/store";
import { getCurrentRestaurantId } from "@/server/tenant";

const IN_FLIGHT: ReadonlySet<string> = new Set(["queued", "scheduled", "running"]);

async function loadSnapshot(input?: {
  store?: StorePanel;
  roi?: RoiSummary;
}): Promise<AdvisorSnapshot> {
  const restaurantId = await getCurrentRestaurantId();
  const [store, roi, customers, campaigns, audiences] = await Promise.all([
    input?.store ? Promise.resolve(input.store) : getStorePanel(),
    input?.roi ? Promise.resolve(input.roi) : getRoiSummary(restaurantId),
    listCustomers(undefined, restaurantId),
    listCampaigns(),
    listAudiences(restaurantId),
  ]);

  const optedInTotal = customers.filter((customer) =>
    hasProvenOptIn({
      optIn: customer.optIn,
      optInAt: customer.optInAt,
      optInSource: customer.optInSource,
      optInProof: customer.optInProof,
    }),
  ).length;

  const byAudience: Record<string, number> = {};
  const audienceLabels: Record<string, string> = {};
  for (const audience of audiences) {
    byAudience[audience.slug] = audience.optedIn;
    audienceLabels[audience.slug] = audience.name;
  }

  const inFlight = campaigns.filter((campaign) => IN_FLIGHT.has(campaign.status));
  const recentAudienceAt: AdvisorSnapshot["recentAudienceAt"] = {};
  for (const campaign of campaigns) {
    if (campaign.status === "failed") continue;
    const fromId = audiences.find((audience) => audience.id === campaign.audienceId)?.slug;
    const raw = fromId ?? campaign.segment;
    const slug = LEGACY_HEAT_AUDIENCE_SLUGS[raw] ?? raw;
    if (!slug) continue;
    const previous = recentAudienceAt[slug];
    if (!previous || campaign.createdAt > previous) {
      recentAudienceAt[slug] = campaign.createdAt;
    }
  }

  return {
    storeName: store.storeName,
    menuUrl: store.menuUrl,
    whatsappConnected: store.whatsapp.connected,
    qualityRating: store.whatsapp.qualityRating,
    quotaRemaining: store.quota.remaining,
    quotaIncluded: store.quota.included,
    optedInTotal,
    totalCustomers: customers.length,
    byAudience,
    audienceLabels,
    inFlightCount: inFlight.length,
    lastCampaignName: campaigns[0]?.name ?? null,
    conversionRate: roi.conversionRate,
    recentAudienceAt,
    now: new Date(),
  };
}

export async function getCampaignAdvice(input?: {
  store?: StorePanel;
  roi?: RoiSummary;
}) {
  return rankAdvice(await loadSnapshot(input));
}

export async function getAdviceById(
  id: string,
  input?: {
    store?: StorePanel;
    roi?: RoiSummary;
  },
) {
  return adviceById(await loadSnapshot(input), id);
}
