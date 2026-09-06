import { timingSafeEqual } from "crypto";
import {
  getAsaasWebhookToken,
  isAsaasConfigured,
  type AsaasBillingType,
} from "@/lib/billing/asaas-config";
import { DEFAULT_PLAN, PLANS, type PlanSlug } from "@/lib/billing/plans";
import {
  BackendUnavailableError,
  DEMO_RESTAURANT_ID,
  isDemoMode,
  requireLiveBackend,
} from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AsaasApiError,
  AsaasNotConfiguredError,
  createAsaasCustomer,
  createAsaasSubscription,
  findAsaasCustomerByExternalReference,
  listSubscriptionPayments,
} from "@/server/billing/asaas-client";

export { AsaasApiError, AsaasNotConfiguredError };

const PLAN_SLUGS = new Set(PLANS.map((p) => p.slug));

function isPlanSlug(value: string): value is PlanSlug {
  return PLAN_SLUGS.has(value as PlanSlug);
}

function planBySlug(slug: PlanSlug) {
  return PLANS.find((p) => p.slug === slug) ?? DEFAULT_PLAN;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function nextDueDateIso(daysAhead = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function externalRef(restaurantId: string, planSlug: PlanSlug) {
  return `${restaurantId}:${planSlug}`;
}

export function parseExternalRef(ref: string | null | undefined): {
  restaurantId: string;
  planSlug: PlanSlug;
} | null {
  if (!ref) return null;
  const [restaurantId, planSlug] = ref.split(":");
  if (!restaurantId || !planSlug || !isPlanSlug(planSlug)) return null;
  return { restaurantId, planSlug };
}

export function verifyAsaasWebhookToken(headerValue: string | null) {
  const expected = getAsaasWebhookToken();
  if (!expected || !headerValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type CheckoutResult = {
  ok: true;
  configured: true;
  subscriptionId: string;
  customerId: string;
  invoiceUrl: string | null;
  billingType: AsaasBillingType;
  planSlug: PlanSlug;
  demo?: boolean;
};

export async function startPlanCheckout(input: {
  restaurantId: string;
  planSlug: PlanSlug;
  billingType: AsaasBillingType;
  cpfCnpj: string;
}): Promise<CheckoutResult> {
  if (!isAsaasConfigured()) {
    throw new AsaasNotConfiguredError();
  }

  if (isDemoMode()) {
    return {
      ok: true,
      configured: true,
      subscriptionId: `demo_sub_${input.planSlug}`,
      customerId: `demo_cus_${DEMO_RESTAURANT_ID}`,
      invoiceUrl: null,
      billingType: input.billingType,
      planSlug: input.planSlug,
      demo: true,
    };
  }

  requireLiveBackend();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const cpfCnpj = onlyDigits(input.cpfCnpj);
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new Error("Informe um CPF (11) ou CNPJ (14) válido.");
  }

  const plan = planBySlug(input.planSlug);
  const valueReais = plan.priceCents / 100;
  const ref = externalRef(input.restaurantId, input.planSlug);

  const [{ data: restaurant }, server] = await Promise.all([
    admin
      .from("restaurants")
      .select("id, name, asaas_customer_id, billing_cpf_cnpj")
      .eq("id", input.restaurantId)
      .maybeSingle(),
    createSupabaseServerClient(),
  ]);

  if (!restaurant) throw new Error("Loja não encontrada.");

  const user = server ? (await server.auth.getUser()).data.user : null;
  const email = user?.email?.trim();
  if (!email) throw new Error("Conta sem e-mail — não dá para criar cliente no Asaas.");

  let customerId = restaurant.asaas_customer_id as string | null;
  if (!customerId) {
    const existing = await findAsaasCustomerByExternalReference(input.restaurantId);
    if (existing?.id) {
      customerId = existing.id;
    } else {
      const created = await createAsaasCustomer({
        name: (restaurant.name as string) || "Loja Nocaute",
        email,
        cpfCnpj,
        externalReference: input.restaurantId,
      });
      customerId = created.id;
    }

    await admin
      .from("restaurants")
      .update({
        asaas_customer_id: customerId,
        billing_cpf_cnpj: cpfCnpj,
      })
      .eq("id", input.restaurantId);
  } else if (!restaurant.billing_cpf_cnpj) {
    await admin
      .from("restaurants")
      .update({ billing_cpf_cnpj: cpfCnpj })
      .eq("id", input.restaurantId);
  }

  const subscription = await createAsaasSubscription({
    customerId,
    billingType: input.billingType,
    value: valueReais,
    description: `Nocaute · Plano ${plan.name}`,
    externalReference: ref,
    nextDueDate: nextDueDateIso(0),
  });

  const payments = await listSubscriptionPayments(subscription.id);
  const firstPayment = payments[0];
  const invoiceUrl =
    firstPayment?.invoiceUrl ??
    firstPayment?.bankSlipUrl ??
    subscription.invoiceUrl ??
    null;

  // Não libera o plano novo aqui — só grava IDs Asaas + pending. Ativação no webhook.
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();

  if (!existingSub) {
    await admin.rpc("apply_subscription_plan", {
      p_restaurant_id: input.restaurantId,
      p_plan_slug: DEFAULT_PLAN.slug,
      p_status: "past_due",
      p_asaas_subscription_id: subscription.id,
      p_asaas_customer_id: customerId,
      p_billing_type: input.billingType,
      p_last_payment_id: firstPayment?.id ?? null,
    });
  }

  await admin
    .from("subscriptions")
    .update({
      asaas_subscription_id: subscription.id,
      asaas_customer_id: customerId,
      billing_type: input.billingType,
      pending_plan_slug: input.planSlug,
      last_payment_id: firstPayment?.id ?? null,
      last_payment_at: firstPayment?.id ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", input.restaurantId);

  return {
    ok: true,
    configured: true,
    subscriptionId: subscription.id,
    customerId,
    invoiceUrl,
    billingType: input.billingType,
    planSlug: input.planSlug,
  };
}

type AsaasWebhookBody = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    customer?: string;
    subscription?: string | null;
    value?: number;
    status?: string;
    billingType?: string;
    externalReference?: string | null;
    invoiceUrl?: string | null;
  };
};

function webhookEventId(body: AsaasWebhookBody) {
  if (body.id) return String(body.id);
  const paymentId = body.payment?.id ?? "unknown";
  const event = body.event ?? "unknown";
  return `${event}:${paymentId}`;
}

export async function handleAsaasWebhook(rawBody: string) {
  if (!isAsaasConfigured()) {
    throw new AsaasNotConfiguredError();
  }

  let body: AsaasWebhookBody;
  try {
    body = JSON.parse(rawBody) as AsaasWebhookBody;
  } catch {
    throw new Error("JSON de webhook inválido.");
  }

  const eventType = body.event ?? "UNKNOWN";
  const payment = body.payment;
  const eventId = webhookEventId(body);

  requireLiveBackend();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const { data: existing } = await admin
    .from("billing_webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (existing) {
    return { ok: true as const, duplicate: true as const, eventType };
  }

  const parsed = parseExternalRef(payment?.externalReference ?? null);
  let restaurantId = parsed?.restaurantId ?? null;
  let planSlug = parsed?.planSlug ?? null;

  if (!restaurantId && payment?.subscription) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("restaurant_id, plan_id, pending_plan_slug")
      .eq("asaas_subscription_id", payment.subscription)
      .maybeSingle();
    if (sub?.restaurant_id) {
      restaurantId = sub.restaurant_id as string;
      if (sub.pending_plan_slug && isPlanSlug(sub.pending_plan_slug)) {
        planSlug = sub.pending_plan_slug;
      } else if (!planSlug && sub.plan_id) {
        const { data: plan } = await admin
          .from("plans")
          .select("slug")
          .eq("id", sub.plan_id)
          .maybeSingle();
        if (plan?.slug && isPlanSlug(plan.slug)) planSlug = plan.slug;
      }
    }
  }

  if (restaurantId && !planSlug) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("pending_plan_slug")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (sub?.pending_plan_slug && isPlanSlug(sub.pending_plan_slug)) {
      planSlug = sub.pending_plan_slug;
    }
  }

  await admin.from("billing_webhook_events").insert({
    id: eventId,
    provider: "asaas",
    event_type: eventType,
    payment_id: payment?.id ?? null,
    subscription_id: payment?.subscription ?? null,
    restaurant_id: restaurantId,
    payload: body as object,
  });

  if (!restaurantId || !planSlug) {
    return { ok: true as const, duplicate: false as const, eventType, skipped: true as const };
  }

  const billingType =
    payment?.billingType === "PIX" || payment?.billingType === "CREDIT_CARD"
      ? payment.billingType
      : null;

  if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
    await admin.rpc("apply_subscription_plan", {
      p_restaurant_id: restaurantId,
      p_plan_slug: planSlug,
      p_status: "active",
      p_asaas_subscription_id: payment?.subscription ?? null,
      p_asaas_customer_id: payment?.customer ?? null,
      p_billing_type: billingType,
      p_last_payment_id: payment?.id ?? null,
    });
  } else if (eventType === "PAYMENT_OVERDUE" || eventType === "PAYMENT_DELETED") {
    await admin.rpc("apply_subscription_plan", {
      p_restaurant_id: restaurantId,
      p_plan_slug: planSlug,
      p_status: "past_due",
      p_asaas_subscription_id: payment?.subscription ?? null,
      p_asaas_customer_id: payment?.customer ?? null,
      p_billing_type: billingType,
      p_last_payment_id: payment?.id ?? null,
    });
  } else if (eventType === "PAYMENT_REFUNDED") {
    await admin.rpc("apply_subscription_plan", {
      p_restaurant_id: restaurantId,
      p_plan_slug: planSlug,
      p_status: "canceled",
      p_asaas_subscription_id: payment?.subscription ?? null,
      p_asaas_customer_id: payment?.customer ?? null,
      p_billing_type: billingType,
      p_last_payment_id: payment?.id ?? null,
    });
  }

  return { ok: true as const, duplicate: false as const, eventType, restaurantId, planSlug };
}
