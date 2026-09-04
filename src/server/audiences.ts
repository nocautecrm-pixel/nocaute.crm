import { cookies } from "next/headers";
import { DEFAULT_AUDIENCES, LEGACY_HEAT_AUDIENCE_SLUGS, matchesAudienceDays, slugFromName } from "@/lib/audiences/defaults";
import type { Audience, AudienceWithCount } from "@/lib/audiences/types";
import {
  BackendUnavailableError,
  isDemoMode,
  requireLiveBackend,
} from "@/lib/config";
import { hasProvenOptIn } from "@/lib/customers/opt-in";
import { daysSince } from "@/lib/segments/recency";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listCustomers } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";

const DEMO_AUDIENCES_COOKIE = "nocaute_audiences";

type DemoAudienceState = {
  extras: Audience[];
  names: Record<string, string>;
};

function defaultAudiences(restaurantId: string, names: Record<string, string> = {}): Audience[] {
  const now = new Date().toISOString();
  return DEFAULT_AUDIENCES.map((item) => ({
    id: `aud-${item.slug}`,
    restaurantId,
    slug: item.slug,
    name: names[item.slug] || item.name,
    minDays: item.minDays,
    maxDays: item.maxDays,
    isDefault: true,
    createdAt: now,
  }));
}

async function readDemoState(): Promise<DemoAudienceState> {
  const jar = await cookies();
  const raw = jar.get(DEMO_AUDIENCES_COOKIE)?.value;
  if (!raw) return { extras: [], names: {} };
  try {
    const parsed = JSON.parse(raw) as DemoAudienceState;
    return {
      extras: Array.isArray(parsed.extras) ? parsed.extras : [],
      names: parsed.names && typeof parsed.names === "object" ? parsed.names : {},
    };
  } catch {
    return { extras: [], names: {} };
  }
}

async function writeDemoState(state: DemoAudienceState) {
  const jar = await cookies();
  jar.set(DEMO_AUDIENCES_COOKIE, JSON.stringify(state), { path: "/", sameSite: "lax" });
}

function mapRow(row: Record<string, unknown>): Audience {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    slug: String(row.slug),
    name: String(row.name),
    minDays: Number(row.min_days),
    maxDays: Number(row.max_days),
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
  };
}

async function seedLiveDefaults(restaurantId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();
  const { data: existing, error: existingError } = await admin
    .from("audiences")
    .select("id, slug, is_default")
    .eq("restaurant_id", restaurantId);
  if (existingError) throw existingError;

  const have = new Set((existing ?? []).map((row) => String(row.slug)));

  for (const row of existing ?? []) {
    if (!row.is_default) continue;
    const nextSlug = LEGACY_HEAT_AUDIENCE_SLUGS[String(row.slug)];
    if (!nextSlug) continue;
    const target = DEFAULT_AUDIENCES.find((item) => item.slug === nextSlug);
    if (!target) continue;
    if (have.has(nextSlug)) {
      const { error } = await admin
        .from("audiences")
        .delete()
        .eq("id", row.id)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
      have.delete(String(row.slug));
      continue;
    }
    const { error } = await admin
      .from("audiences")
      .update({
        slug: target.slug,
        name: target.name,
        min_days: target.minDays,
        max_days: target.maxDays,
        is_default: true,
      })
      .eq("id", row.id)
      .eq("restaurant_id", restaurantId);
    if (error) throw error;
    have.delete(String(row.slug));
    have.add(nextSlug);
  }

  const missing = DEFAULT_AUDIENCES.filter((item) => !have.has(item.slug));
  if (missing.length === 0) return;
  const { error } = await admin.from("audiences").insert(
    missing.map((item) => ({
      restaurant_id: restaurantId,
      slug: item.slug,
      name: item.name,
      min_days: item.minDays,
      max_days: item.maxDays,
      is_default: true,
    })),
  );
  if (error) throw error;
}

export async function listAudiences(restaurantId?: string): Promise<AudienceWithCount[]> {
  const id = restaurantId ?? (await getCurrentRestaurantId());
  let audiences: Audience[];

  if (isDemoMode()) {
    const state = await readDemoState();
    audiences = [...defaultAudiences(id, state.names), ...state.extras];
  } else {
    requireLiveBackend();
    const admin = createSupabaseAdminClient();
    if (!admin) throw new BackendUnavailableError();
    try {
      await seedLiveDefaults(id);
      const { data, error } = await admin
        .from("audiences")
        .select("id, restaurant_id, slug, name, min_days, max_days, is_default, created_at")
        .eq("restaurant_id", id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      audiences = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
      audiences.sort((a, b) => {
        const ai = DEFAULT_AUDIENCES.findIndex((item) => item.slug === a.slug);
        const bi = DEFAULT_AUDIENCES.findIndex((item) => item.slug === b.slug);
        if (a.isDefault && b.isDefault) {
          return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        }
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
    } catch {
      audiences = defaultAudiences(id);
    }
  }

  const customers = await listCustomers(undefined, id);
  return audiences.map((audience) => {
    const matched = customers.filter((customer) =>
      matchesAudienceDays(daysSince(customer.lastPurchaseAt), audience.minDays, audience.maxDays),
    );
    const optedIn = matched.filter((customer) =>
      hasProvenOptIn({
        optIn: customer.optIn,
        optInAt: customer.optInAt,
        optInSource: customer.optInSource,
        optInProof: customer.optInProof,
      }),
    );
    return { ...audience, total: matched.length, optedIn: optedIn.length };
  });
}

export async function getAudience(id: string, restaurantId?: string) {
  const audiences = await listAudiences(restaurantId);
  return audiences.find((audience) => audience.id === id || audience.slug === id) ?? null;
}

export async function createAudience(input: { name: string; minDays: number; maxDays: number }) {
  const restaurantId = await getCurrentRestaurantId();
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Informe o nome do público.");
  if (input.maxDays < input.minDays) throw new Error("A faixa de dias está invertida.");

  let slug = slugFromName(name);
  const current = await listAudiences(restaurantId);
  if (current.some((audience) => audience.slug === slug)) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  if (isDemoMode()) {
    const state = await readDemoState();
    const audience: Audience = {
      id: `aud-${slug}`,
      restaurantId,
      slug,
      name,
      minDays: input.minDays,
      maxDays: input.maxDays,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    await writeDemoState({ ...state, extras: [...state.extras, audience] });
    return audience;
  }

  requireLiveBackend();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();
  const { data, error } = await admin
    .from("audiences")
    .insert({
      restaurant_id: restaurantId,
      slug,
      name,
      min_days: input.minDays,
      max_days: input.maxDays,
      is_default: false,
    })
    .select("id, restaurant_id, slug, name, min_days, max_days, is_default, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível criar o público.");
  return mapRow(data as Record<string, unknown>);
}

export async function updateAudience(
  id: string,
  input: { name?: string; minDays?: number; maxDays?: number },
) {
  const restaurantId = await getCurrentRestaurantId();
  const current = await getAudience(id, restaurantId);
  if (!current) throw new Error("Público não encontrado.");

  const name = input.name?.trim() || current.name;
  const minDays = input.minDays ?? current.minDays;
  const maxDays = input.maxDays ?? current.maxDays;
  if (name.length < 2) throw new Error("Informe o nome do público.");
  if (maxDays < minDays) throw new Error("A faixa de dias está invertida.");
  if (current.isDefault && (minDays !== current.minDays || maxDays !== current.maxDays)) {
    throw new Error("A faixa dos públicos padrão não muda. Crie um público novo.");
  }

  if (isDemoMode()) {
    const state = await readDemoState();
    if (current.isDefault) {
      await writeDemoState({ ...state, names: { ...state.names, [current.slug]: name } });
      return { ...current, name };
    }
    await writeDemoState({
      ...state,
      extras: state.extras.map((audience) =>
        audience.id === current.id ? { ...audience, name, minDays, maxDays } : audience,
      ),
    });
    return { ...current, name, minDays, maxDays };
  }

  requireLiveBackend();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();
  const { data, error } = await admin
    .from("audiences")
    .update({ name, min_days: minDays, max_days: maxDays })
    .eq("id", current.id)
    .eq("restaurant_id", restaurantId)
    .select("id, restaurant_id, slug, name, min_days, max_days, is_default, created_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Público não encontrado.");
  return mapRow(data as Record<string, unknown>);
}

export async function deleteAudience(id: string) {
  const restaurantId = await getCurrentRestaurantId();
  const current = await getAudience(id, restaurantId);
  if (!current) throw new Error("Público não encontrado.");
  if (current.isDefault) throw new Error("Público padrão não pode ser apagado. Renomeie se quiser.");

  if (isDemoMode()) {
    const state = await readDemoState();
    await writeDemoState({
      ...state,
      extras: state.extras.filter((audience) => audience.id !== current.id),
    });
    return { ok: true as const };
  }

  requireLiveBackend();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();
  const { error } = await admin.from("audiences").delete().eq("id", current.id).eq("restaurant_id", restaurantId);
  if (error) throw error;
  return { ok: true as const };
}
