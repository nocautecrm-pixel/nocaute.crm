import { cookies } from "next/headers";
import { customerCareWindow } from "@/lib/whatsapp/window";
import {
  BackendUnavailableError,
  DEMO_RESTAURANT_ID,
  getAppUrl,
  getGraphVersion,
  isDemoMode,
  isEmbeddedSignupConfigured,
  requireLiveBackend,
} from "@/lib/config";
import {
  buildMetaHealth,
  campaignStatusLabel,
  DEMO_STORE,
  DEMO_WHATSAPP_COOKIE,
  withDemoWhatsAppConnection,
} from "@/lib/demo/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  META_CONNECTED_LABEL,
  META_DISCONNECTED_LABEL,
} from "@/lib/whatsapp/constants";
import { getQuotaSnapshot } from "@/server/billing/quota-gateway";
import { listCampaigns } from "@/server/campaigns";
import { getRoiSummary } from "@/server/roi";
import { uploadRestaurantMedia } from "@/server/media";
import { getCurrentRestaurantId } from "@/server/tenant";
import type { StorePanel } from "@/types/store";

export async function getStorePanel(): Promise<StorePanel> {
  const jar = await cookies();
  const demoConnected = jar.get(DEMO_WHATSAPP_COOKIE)?.value === "1";

  if (isDemoMode()) {
    const quota = await getQuotaSnapshot(DEMO_RESTAURANT_ID);
    const nameCookie = jar.get("store_name");
    const cityCookie = jar.get("store_city");
    const cookieLogo = jar.get("store_logo_url")?.value?.trim();
    const cookieMenu = jar.get("store_menu_url")?.value?.trim();
    const cookieAddress = jar.get("store_address")?.value?.trim();
    const cookieHours = jar.get("store_hours_text")?.value?.trim();
    const profileCleared = nameCookie !== undefined && !nameCookie.value.trim();
    return {
      ...withDemoWhatsAppConnection(
        {
          ...DEMO_STORE,
          // Cookie presente (mesmo vazio) = perfil gravado/limpo; sem cookie = demo padrão.
          storeName: nameCookie ? nameCookie.value : DEMO_STORE.storeName,
          city: cityCookie ? cityCookie.value : DEMO_STORE.city,
          logoUrl: profileCleared ? null : cookieLogo || DEMO_STORE.logoUrl,
          menuUrl: profileCleared ? "" : cookieMenu || DEMO_STORE.menuUrl,
          address: profileCleared ? "" : cookieAddress || DEMO_STORE.address,
          hoursText: profileCleared ? "" : cookieHours || DEMO_STORE.hoursText,
        },
        demoConnected,
      ),
      quota,
    };
  }

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new BackendUnavailableError();
  }

  const restaurantId = await getCurrentRestaurantId();
  const quota = await getQuotaSnapshot(restaurantId);

  const [{ data: restaurant }, { data: account }, roi, campaigns] = await Promise.all([
    admin.from("restaurants").select("name, city, logo_url, menu_url, address, hours_text").eq("id", restaurantId).maybeSingle(),
    admin
      .from("whatsapp_accounts")
      .select(
        "status, display_phone, verified_name, waba_id, phone_number_id, quality_rating, last_inbound_at",
      )
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    getRoiSummary(restaurantId),
    listCampaigns(),
  ]);

  const connected = account?.status === "connected";
  const window = customerCareWindow(account?.last_inbound_at ?? null);
  // Sem fallback de marca: nome vazio = etapa 1 incompleta (após “desligar perfil”).
  const storeName = restaurant?.name ?? "";

  return {
    productName: DEMO_STORE.productName,
    storeName,
    city: restaurant?.city || "",
    logoUrl: restaurant?.logo_url ?? null,
    menuUrl: restaurant?.menu_url ?? "",
    address: restaurant?.address ?? "",
    hoursText: restaurant?.hours_text ?? "",
    whatsapp: {
      connected,
      channel: "WhatsApp Business",
      provider: "Meta Cloud API",
      label: connected ? META_CONNECTED_LABEL : META_DISCONNECTED_LABEL,
      displayPhone: account?.display_phone ?? null,
      verifiedName: account?.verified_name ?? restaurant?.name ?? null,
      wabaId: account?.waba_id ?? null,
      phoneNumberId: account?.phone_number_id ?? null,
      graphVersion: getGraphVersion(),
      qualityRating: account?.quality_rating ?? null,
      lastInboundAt: account?.last_inbound_at ?? null,
      windowOpen: window.open,
      windowHoursLeft: window.hoursLeft,
    },
    quota,
    meta: buildMetaHealth({
      connected,
      storeName,
      displayPhone: account?.display_phone ?? null,
      verifiedName: account?.verified_name ?? restaurant?.name ?? null,
      quotaUsed: quota.used,
      quotaIncluded: quota.included,
      signupConfigured: isEmbeddedSignupConfigured(),
      webhookReceived: Boolean(account?.last_inbound_at),
      webhookUrl: `${getAppUrl()}/api/webhooks/whatsapp`,
    }),
    kpis: {
      revenueMonth: 0,
      revenueGrowthPct: 0,
      reactivated30d: roi.couponsRedeemed,
      couponConversionPct: roi.conversionRate,
    },
    recentCampaigns: campaigns.slice(0, 5).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      statusLabel: campaignStatusLabel(campaign.status),
      sends: roi.sent,
      conversionPct: roi.conversionRate,
      revenue: 0,
    })),
  };
}

export async function saveStoreProfile(input: {
  name: string;
  city: string;
  menuUrl?: string;
  address?: string;
  hoursText?: string;
}) {
  if (isDemoMode()) {
    const jar = await cookies();
    jar.set("store_name", input.name, { path: "/", sameSite: "lax" });
    jar.set("store_city", input.city, { path: "/", sameSite: "lax" });
    jar.set("store_menu_url", input.menuUrl ?? "", { path: "/", sameSite: "lax" });
    jar.set("store_address", input.address ?? "", { path: "/", sameSite: "lax" });
    jar.set("store_hours_text", input.hoursText ?? "", { path: "/", sameSite: "lax" });
    return { ok: true as const, demo: true as const };
  }

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const restaurantId = await getCurrentRestaurantId();
  const { error } = await admin
    .from("restaurants")
    .update({
      name: input.name,
      city: input.city,
      menu_url: input.menuUrl?.trim() || null,
      address: input.address?.trim() || null,
      hours_text: input.hoursText?.trim() || null,
    })
    .eq("id", restaurantId);

  if (error) throw error;
  return { ok: true as const, demo: false as const };
}

/** Limpa o perfil da loja no Nocaute (etapa 1 volta a pendente). Não apaga a conta. */
export async function clearStoreProfile() {
  if (isDemoMode()) {
    const jar = await cookies();
    jar.set("store_name", "", { path: "/", sameSite: "lax" });
    jar.set("store_city", "", { path: "/", sameSite: "lax" });
    jar.set("store_menu_url", "", { path: "/", sameSite: "lax" });
    jar.set("store_address", "", { path: "/", sameSite: "lax" });
    jar.set("store_hours_text", "", { path: "/", sameSite: "lax" });
    jar.set("store_logo_url", "", { path: "/", sameSite: "lax" });
    return { ok: true as const, demo: true as const };
  }

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const restaurantId = await getCurrentRestaurantId();
  const { error } = await admin
    .from("restaurants")
    .update({
      name: "",
      city: "",
      menu_url: null,
      address: null,
      hours_text: null,
      logo_url: null,
    })
    .eq("id", restaurantId);

  if (error) throw error;
  return { ok: true as const, demo: false as const };
}

export async function saveStoreLogo(file: File) {
  const restaurantId = await getCurrentRestaurantId();
  const uploaded = await uploadRestaurantMedia({
    restaurantId,
    file,
    kind: "logo",
  });

  if (isDemoMode()) {
    const jar = await cookies();
    jar.set("store_logo_url", uploaded.url, { path: "/", sameSite: "lax" });
    return { ok: true as const, demo: true as const, url: uploaded.url };
  }

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const { error } = await admin
    .from("restaurants")
    .update({ logo_url: uploaded.url })
    .eq("id", restaurantId);

  if (error) throw error;
  return { ok: true as const, demo: false as const, url: uploaded.url };
}
