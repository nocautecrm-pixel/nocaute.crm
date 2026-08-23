import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function consumeCampaignLead(input: {
  restaurantId: string;
  campaignId: string;
  campaignJobId: string;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("settle_campaign_quota", {
    p_restaurant_id: input.restaurantId,
    p_kind: "consume",
    p_campaign_id: input.campaignId,
    p_campaign_job_id: input.campaignJobId,
  });
  if (error) throw error;
}

export async function refundCampaignLead(input: {
  restaurantId: string;
  campaignId: string;
  campaignJobId: string;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("settle_campaign_quota", {
    p_restaurant_id: input.restaurantId,
    p_kind: "refund",
    p_campaign_id: input.campaignId,
    p_campaign_job_id: input.campaignJobId,
  });
  if (error) throw error;
}

export async function releaseCampaignQuota(input: {
  restaurantId: string;
  leads: number;
  campaignId?: string | null;
}) {
  if (input.leads < 1) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("release_campaign_quota", {
    p_restaurant_id: input.restaurantId,
    p_leads: input.leads,
    p_campaign_id: input.campaignId ?? null,
  });
  if (error) throw error;
}

export async function reserveCampaignQuotaRpc(input: {
  restaurantId: string;
  leads: number;
  campaignId?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("reserve_campaign_quota", {
    p_restaurant_id: input.restaurantId,
    p_leads: input.leads,
    p_campaign_id: input.campaignId ?? null,
  });

  if (error) throw error;
  return data as {
    ok: boolean;
    remaining: number;
    included: number;
    used: number;
    reserved: number;
  };
}
