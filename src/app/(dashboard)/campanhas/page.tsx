import { CampaignWizard } from "@/components/campaigns/CampaignWizard";
import { getAdviceById } from "@/server/advisor/gateway";
import { listAudiences } from "@/server/audiences";
import { getStorePanel } from "@/server/store";
import { getCurrentRestaurantId } from "@/server/tenant";

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ advice?: string }>;
}) {
  const params = await searchParams;
  const restaurantId = await getCurrentRestaurantId();
  const [store, audiences] = await Promise.all([
    getStorePanel(),
    listAudiences(restaurantId),
  ]);
  const advice = params.advice ? await getAdviceById(params.advice, { store }) : null;
  const draft = advice?.action.type === "prefill_campaign" ? advice.action.draft : null;

  return (
    <div className="h-full min-h-0">
      <CampaignWizard
        key={advice?.id ?? "blank"}
        storeName={store.storeName}
        menuUrl={store.menuUrl}
        audiences={audiences}
        draft={draft}
        adviceWhy={draft ? advice?.why : null}
      />
    </div>
  );
}
