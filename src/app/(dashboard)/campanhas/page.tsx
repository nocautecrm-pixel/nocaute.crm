import { CampaignWizard } from "@/components/campaigns/CampaignWizard";
import { getStorePanel } from "@/server/store";

export default async function CampanhasPage() {
  const store = await getStorePanel();
  return (
    <div className="h-full min-h-0">
      <CampaignWizard storeName={store.storeName} menuUrl={store.menuUrl} />
    </div>
  );
}
