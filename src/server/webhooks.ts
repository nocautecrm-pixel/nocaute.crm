import { BRAND } from "@/lib/brand";
import { isDemoMode, isRedisConfigured } from "@/lib/config";
import { extractCouponCode } from "@/lib/coupons/parse";
import type { CampaignOfferJob } from "@/lib/queue/jobs";
import { getCampaignOfferQueue } from "@/lib/queue/queues";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isConfirmOptInClick,
  parseWebhookPayload,
  type MetaInboundMessage,
} from "@/lib/whatsapp/inbound";
import { digitsOnly, phonesMatch } from "@/lib/whatsapp/phone";
import { withCouponQuery } from "@/lib/whatsapp/payloads";
import { redeemCoupon } from "@/server/conversions";
import { replyWithBrandDna } from "@/server/chatbot-engine";
import {
  findRestaurantByPhoneNumberId,
  touchLastInbound,
} from "@/server/whatsapp-account";

const AWAITING = ["awaiting_confirm", "delivered", "read"];

export async function ingestWhatsAppPayload(rawBody: string) {
  const payload = parseWebhookPayload(rawBody);
  if (payload.object !== "whatsapp_business_account") return { ignored: true };

  let conversions = 0;
  let statuses = 0;
  let confirms = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      for (const status of value.statuses ?? []) {
        statuses += 1;
        await applyDeliveryStatus(status.id, status.status);
      }

      for (const message of value.messages ?? []) {
        const restaurantId = await findRestaurantByPhoneNumberId(value.metadata?.phone_number_id);
        if (restaurantId) await touchLastInbound(restaurantId);

        if (isConfirmOptInClick(message)) {
          if (!restaurantId) {
            throw new Error("phone_number_id sem loja mapeada para confirmar opt-in.");
          }
          const result = await handleOptInConfirmation(message, restaurantId);
          if (result.enqueued || result.demo) confirms += 1;
          continue;
        }

        const body = message.text?.body ?? "";
        const code = extractCouponCode(body);
        if (code && restaurantId) {
          const redeemed = await redeemCoupon(code, "inbound_whatsapp", restaurantId);
          if ("ok" in redeemed && redeemed.ok) conversions += 1;
          continue;
        }

        if (restaurantId && body.trim()) {
          await replyWithBrandDna({
            restaurantId,
            storeName: BRAND.storeName,
            to: message.from,
            customerMessage: body,
          });
        }
      }
    }
  }

  return { ignored: false, statuses, conversions, confirms };
}

async function applyDeliveryStatus(wamid: string, status: string) {
  if (isDemoMode()) return;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin indisponível para status de entrega.");
  }

  const mapped = mapDeliveryStatus(status);
  if (!mapped) return;

  const job = await findJobByWamid(wamid);
  if (!job) return;

  if (["awaiting_confirm", "confirmed", "offer_sent"].includes(job.status) && mapped !== "failed") {
    return;
  }

  await admin.from("campaign_jobs").update({ status: mapped }).eq("id", job.id);
}

function mapDeliveryStatus(status: string) {
  if (status === "delivered") return "delivered";
  if (status === "read") return "read";
  if (status === "failed") return "failed";
  return null;
}

async function findJobByWamid(wamid: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  for (const column of ["optin_wamid", "provider_message_id", "offer_wamid"] as const) {
    const { data } = await admin
      .from("campaign_jobs")
      .select("id, status")
      .eq(column, wamid)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

export async function handleOptInConfirmation(message: MetaInboundMessage, restaurantId: string) {
  if (isDemoMode()) {
    return {
      demo: true as const,
      from: digitsOnly(message.from),
      next: "offer_sequence" as const,
      message: "Clique em Confirmar detectado. Sem banco, a sequência de oferta não é disparada.",
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin indisponível para processar o opt-in.");
  }

  const job = await findAwaitingJob(message, restaurantId);
  if (!job) return { enqueued: false as const, reason: "job_not_found" as const };

  if (job.status === "offer_sent" || job.status === "confirmed") {
    return { enqueued: false as const, reason: "already_processed" as const };
  }

  await admin
    .from("customers")
    .update({
      opt_in: true,
      opt_in_at: new Date().toISOString(),
      opt_in_source: "confirmacao_whatsapp",
      opt_in_proof: `wamid:${message.id}`,
    })
    .eq("id", job.customer_id)
    .eq("restaurant_id", restaurantId);

  await admin
    .from("campaign_jobs")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("restaurant_id", restaurantId)
    .eq("status", job.status);

  if (!isRedisConfigured()) {
    return { enqueued: false as const, reason: "redis_missing" as const, campaignJobId: job.id };
  }

  const offerJob: CampaignOfferJob = {
    campaignId: job.campaign.id,
    campaignJobId: job.id,
    restaurantId: job.restaurant_id,
    customerId: job.customer_id,
    customerPhone: job.customer.phone,
    couponCode: job.campaign.promo_code,
    establishmentName: job.campaign.establishment_name,
    discountLabel: job.campaign.discount_label,
    offerBody: job.campaign.offer_body,
    mediaType: job.campaign.media_type,
    mediaUrl: job.campaign.media_url,
    mediaCaption: job.campaign.media_caption,
    ctaUrl: withCouponQuery(
      job.campaign.cta_url ?? BRAND.ctaUrl,
      job.trackingCode,
    ),
    ctaLabel: job.campaign.cta_label,
  };

  await getCampaignOfferQueue().add("offer", offerJob, {
    jobId: `offer-${job.id}`,
  });

  return { enqueued: true as const, campaignJobId: job.id };
}

async function findAwaitingJob(message: MetaInboundMessage, restaurantId: string) {
  if (message.context?.id) {
    const byContext = await loadJobRow({ optin_wamid: message.context.id }, restaurantId);
    if (byContext) return byContext;
    const byProvider = await loadJobRow({ provider_message_id: message.context.id }, restaurantId);
    if (byProvider) return byProvider;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: rows } = await admin
    .from("campaign_jobs")
    .select(jobSelect())
    .eq("restaurant_id", restaurantId)
    .in("status", AWAITING)
    .order("sent_at", { ascending: false })
    .limit(50);

  const list = (rows ?? []) as unknown as JobRow[];
  const match = list.find((row) => {
    const customer = asOne(row.customers);
    return customer?.phone ? phonesMatch(customer.phone, message.from) : false;
  });

  return match ? await hydrateJob(match) : null;
}

async function loadJobRow(filter: Record<string, string>, restaurantId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const column = Object.keys(filter)[0];
  const value = filter[column];
  const { data } = await admin
    .from("campaign_jobs")
    .select(jobSelect())
    .eq(column, value)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return data ? await hydrateJob(data as unknown as JobRow) : null;
}

type JobRow = {
  id: string;
  status: string;
  restaurant_id: string;
  customer_id: string;
  coupon_id: string | null;
  customers: { phone: string } | { phone: string }[] | null;
  campaigns: Record<string, unknown> | Record<string, unknown>[] | null;
};

function jobSelect() {
  return `
    id,
    status,
    restaurant_id,
    customer_id,
    coupon_id,
    customers (phone),
    campaigns (
      id,
      establishment_name,
      promo_code,
      offer_body,
      media_type,
      media_url,
      media_caption,
      cta_url,
      cta_label,
      discount_label
    )
  `;
}

async function hydrateJob(row: JobRow) {
  const campaign = asOne(row.campaigns);
  const customer = asOne(row.customers);

  if (!campaign || !customer) return null;

  let trackingCode = String(campaign.promo_code ?? BRAND.promoCode);
  const couponId = row.coupon_id as string | null;
  if (couponId) {
    const admin = createSupabaseAdminClient();
    const { data } = admin
      ? await admin
          .from("coupons")
          .select("code")
          .eq("id", couponId)
          .eq("restaurant_id", row.restaurant_id)
          .maybeSingle()
      : { data: null };
    if (data?.code) trackingCode = data.code;
  }

  return {
    id: row.id as string,
    status: row.status as string,
    restaurant_id: row.restaurant_id as string,
    customer_id: row.customer_id as string,
    customer,
    campaign: {
      id: String(campaign.id),
      establishment_name: String(campaign.establishment_name ?? BRAND.storeName),
      promo_code: String(campaign.promo_code ?? BRAND.promoCode),
      offer_body: String(campaign.offer_body ?? ""),
      media_type: (campaign.media_type as "image" | "video" | null) ?? null,
      media_url: (campaign.media_url as string | null) ?? null,
      media_caption: (campaign.media_caption as string | null) ?? null,
      cta_url: (campaign.cta_url as string | null) ?? null,
      cta_label: String(campaign.cta_label ?? "Resgatar Cupom"),
      discount_label: String(campaign.discount_label ?? "15% OFF"),
    },
    trackingCode,
  };
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
