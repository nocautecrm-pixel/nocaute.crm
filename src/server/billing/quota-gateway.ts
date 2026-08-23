import { cookies } from "next/headers";
import {
  currentCalendarPeriod,
  DEFAULT_PLAN,
  PLANS,
  QuotaExceededError,
  remainingOf,
  type QuotaSnapshot,
} from "@/lib/billing/plans";
import { BackendUnavailableError, DEMO_RESTAURANT_ID, isDemoMode, requireLiveBackend } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  consumeCampaignLead,
  refundCampaignLead,
  releaseCampaignQuota,
  reserveCampaignQuotaRpc,
} from "@/server/billing/quota-rpc";

export { consumeCampaignLead, refundCampaignLead, releaseCampaignQuota };

export const DEMO_QUOTA_COOKIE = "nocaute_quota";

type DemoQuota = {
  used: number;
  reserved: number;
};

function snapshotFromCounts(used: number, reserved: number): QuotaSnapshot {
  const period = currentCalendarPeriod();
  const included = DEFAULT_PLAN.includedLeads;
  return {
    planSlug: DEFAULT_PLAN.slug,
    planName: DEFAULT_PLAN.name,
    priceCents: DEFAULT_PLAN.priceCents,
    included,
    extra: 0,
    used,
    reserved,
    remaining: remainingOf({ included, extra: 0, used, reserved }),
    periodStart: period.start,
    periodEnd: period.end,
  };
}

async function readDemoQuota(): Promise<DemoQuota> {
  const jar = await cookies();
  const raw = jar.get(DEMO_QUOTA_COOKIE)?.value;
  if (!raw) return { used: 0, reserved: 0 };
  try {
    const parsed = JSON.parse(raw) as DemoQuota;
    return {
      used: Number(parsed.used) || 0,
      reserved: Number(parsed.reserved) || 0,
    };
  } catch {
    return { used: 0, reserved: 0 };
  }
}

async function writeDemoQuota(quota: DemoQuota) {
  const jar = await cookies();
  jar.set(DEMO_QUOTA_COOKIE, JSON.stringify(quota), { path: "/", sameSite: "lax" });
}

function isQuotaExceededMessage(message: string) {
  return message.startsWith("quota_exceeded:");
}

function throwFromDbMessage(message: string) {
  const parts = message.split(":");
  const remaining = Number(parts[1] ?? 0);
  const needed = Number(parts[2] ?? 0);
  const included = Number(parts[3] ?? DEFAULT_PLAN.includedLeads);
  throw new QuotaExceededError(remaining, needed, included, DEFAULT_PLAN.name);
}

export async function getQuotaSnapshot(restaurantId: string): Promise<QuotaSnapshot> {
  if (isDemoMode()) {
    const demo = await readDemoQuota();
    return snapshotFromCounts(demo.used, demo.reserved);
  }

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new BackendUnavailableError();
  }

  const { data, error } = await admin.rpc("ensure_quota_account", {
    p_restaurant_id: restaurantId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Conta de quota indisponível.");
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    plan_id: string;
    included: number;
    extra: number;
    used: number;
    reserved: number;
    period_start: string;
    period_end: string;
  } | null;

  if (!row) {
    throw new Error("Conta de quota indisponível.");
  }

  const { data: plan } = await admin
    .from("plans")
    .select("slug, name, price_cents, included_leads")
    .eq("id", row.plan_id)
    .maybeSingle();

  const catalog = PLANS.find((item) => item.slug === plan?.slug) ?? DEFAULT_PLAN;

  return {
    planSlug: catalog.slug,
    planName: plan?.name ?? catalog.name,
    priceCents: plan?.price_cents ?? catalog.priceCents,
    included: row.included,
    extra: row.extra,
    used: row.used,
    reserved: row.reserved,
    remaining: remainingOf(row),
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

export async function reserveCampaignQuota(input: {
  restaurantId: string;
  leads: number;
  campaignId?: string | null;
}) {
  if (input.leads < 1) return getQuotaSnapshot(input.restaurantId);

  if (isDemoMode()) {
    const demo = await readDemoQuota();
    const snap = snapshotFromCounts(demo.used, demo.reserved);
    if (snap.remaining < input.leads) {
      throw new QuotaExceededError(snap.remaining, input.leads, snap.included, snap.planName);
    }
    demo.used += input.leads;
    await writeDemoQuota(demo);
    return snapshotFromCounts(demo.used, demo.reserved);
  }

  try {
    const data = await reserveCampaignQuotaRpc(input);
    if (!data) {
      throw new Error("Não foi possível reservar a quota da campanha.");
    }
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isQuotaExceededMessage(message)) throwFromDbMessage(message);
    throw error;
  }
}
