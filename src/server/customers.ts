import { cookies } from "next/headers";
import {
  BackendUnavailableError,
  DEMO_RESTAURANT_ID,
  isDemoMode,
  requireLiveBackend,
} from "@/lib/config";
import type { ParsedCustomerRow } from "@/lib/customers/csv";
import { hasProvenOptIn } from "@/lib/customers/opt-in";
import { demoCustomers } from "@/lib/demo/seed";
import {
  daysSince,
  matchesSegment,
  segmentForDays,
} from "@/lib/segments/recency";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { digitsOnly, normalizeToE164 } from "@/lib/whatsapp/phone";
import type { Customer, CustomerRow, RecencySegment } from "@/types/database";

const DEMO_CUSTOMERS_COOKIE = "nocaute_customers";
const DEMO_IMPORT_CAP = 25;

type DemoCustomerState = {
  extras: Customer[];
  overrides: Record<string, Customer>;
  deleted: string[];
};

type CustomerInput = {
  name: string;
  phone: string;
  segment?: RecencySegment;
  lastVisitAt?: string;
  optIn: boolean;
  optInSource?: string;
  optInProof?: string;
};

function parseVisitAt(raw?: string | null) {
  const value = raw?.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00.000Z`).toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data da última visita inválida.");
  return date.toISOString();
}

function withSegment(customer: Customer): CustomerRow {
  const days = daysSince(customer.lastPurchaseAt);
  return { ...customer, daysWithoutVisit: days, segment: segmentForDays(days) };
}

function emptyDemoState(): DemoCustomerState {
  return { extras: [], overrides: {}, deleted: [] };
}

async function readDemoState(): Promise<DemoCustomerState> {
  const jar = await cookies();
  const raw = jar.get(DEMO_CUSTOMERS_COOKIE)?.value;
  if (!raw) return emptyDemoState();
  try {
    const parsed = JSON.parse(raw) as DemoCustomerState | Customer[];
    if (Array.isArray(parsed)) {
      return { extras: parsed, overrides: {}, deleted: [] };
    }
    return {
      extras: Array.isArray(parsed.extras) ? parsed.extras : [],
      overrides:
        parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
      deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
    };
  } catch {
    return emptyDemoState();
  }
}

async function writeDemoState(state: DemoCustomerState) {
  const jar = await cookies();
  jar.set(DEMO_CUSTOMERS_COOKIE, JSON.stringify(state), {
    path: "/",
    sameSite: "lax",
  });
}

function assembleDemoCustomers(state: DemoCustomerState): Customer[] {
  const seen = new Set<string>();
  const merged: Customer[] = [];

  const extras = state.extras
    .filter((customer) => !state.deleted.includes(customer.id))
    .map((customer) => state.overrides[customer.id] ?? customer);
  const seed = demoCustomers
    .filter((customer) => !state.deleted.includes(customer.id))
    .map((customer) => state.overrides[customer.id] ?? customer);

  for (const customer of [...extras, ...seed]) {
    const key = digitsOnly(customer.phone);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(customer);
  }
  return merged;
}

function phoneTaken(customers: { id: string; phone: string }[], phone: string, exceptId?: string) {
  const key = digitsOnly(phone);
  return customers.some(
    (customer) => customer.id !== exceptId && digitsOnly(customer.phone) === key,
  );
}

function requirePhone(raw: string) {
  const phone = normalizeToE164(raw);
  if (!phone) throw new Error("WhatsApp inválido. Use DDD + número.");
  return phone;
}

function mapRow(row: {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  last_purchase_at: string | null;
  opt_in: boolean;
  opt_in_at: string | null;
  opt_in_source: string | null;
  opt_in_proof: string | null;
  created_at: string;
}): Customer {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    phone: row.phone,
    lastPurchaseAt: row.last_purchase_at,
    optIn: row.opt_in,
    optInAt: row.opt_in_at,
    optInSource: row.opt_in_source,
    optInProof: row.opt_in_proof,
    createdAt: row.created_at,
  };
}

export async function listCustomers(segment?: RecencySegment, restaurantId?: string) {
  if (isDemoMode()) {
    const state = await readDemoState();
    return assembleDemoCustomers(state)
      .map(withSegment)
      .filter((customer) => (segment ? matchesSegment(customer.daysWithoutVisit, segment) : true));
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  requireLiveBackend();

  if (!restaurantId || restaurantId === DEMO_RESTAURANT_ID) {
    throw new Error("Loja não identificada.");
  }

  const { data, error } = await admin
    .from("customers")
    .select(
      "id, restaurant_id, name, phone, last_purchase_at, opt_in, opt_in_at, opt_in_source, opt_in_proof, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("last_purchase_at", { ascending: true, nullsFirst: true });
  if (error) throw error;

  return (data ?? [])
    .map((row) => withSegment(mapRow(row)))
    .filter((customer) => (segment ? matchesSegment(customer.daysWithoutVisit, segment) : true));
}

export async function importCustomers(restaurantId: string, rows: ParsedCustomerRow[]) {
  let imported = 0;
  let duplicates = 0;
  let invalid = 0;

  if (isDemoMode()) {
    const state = await readDemoState();
    const existing = new Set(assembleDemoCustomers(state).map((customer) => digitsOnly(customer.phone)));
    const next = { ...state, extras: [...state.extras] };
    for (const row of rows) {
      const key = digitsOnly(row.phone);
      if (existing.has(key)) {
        duplicates += 1;
        continue;
      }
      if (next.extras.length >= DEMO_IMPORT_CAP) {
        invalid += 1;
        continue;
      }
      existing.add(key);
      next.extras.unshift({
        id: `imp-${key}`,
        restaurantId,
        name: row.name,
        phone: row.phone,
        lastPurchaseAt: row.lastPurchaseAt,
        optIn: row.optIn,
        optInAt: row.optInAt,
        optInSource: row.optInSource,
        optInProof: row.optInProof,
        createdAt: new Date().toISOString(),
      });
      imported += 1;
    }
    await writeDemoState(next);
    return { imported, duplicates, invalid };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");

  const { data: current } = await admin.from("customers").select("phone").eq("restaurant_id", restaurantId);
  const existing = new Set((current ?? []).map((row) => digitsOnly(row.phone)));

  for (const row of rows) {
    const key = digitsOnly(row.phone);
    if (existing.has(key)) {
      duplicates += 1;
      continue;
    }
    const { error } = await admin.from("customers").insert({
      restaurant_id: restaurantId,
      name: row.name,
      phone: row.phone,
      last_purchase_at: row.lastPurchaseAt,
      opt_in: row.optIn,
      opt_in_at: row.optInAt,
      opt_in_source: row.optInSource,
      opt_in_proof: row.optInProof,
    });
    if (error) {
      invalid += 1;
      continue;
    }
    existing.add(key);
    imported += 1;
  }

  return { imported, duplicates, invalid };
}

export async function createCustomer(restaurantId: string, input: CustomerInput) {
  const phone = requirePhone(input.phone);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Informe o nome do cliente.");
  if (input.optIn && (!input.optInSource?.trim() || !input.optInProof?.trim())) {
    throw new Error("Opt-in exige origem e comprovante auditável.");
  }
  const lastPurchaseAt = parseVisitAt(input.lastVisitAt) ?? new Date().toISOString();
  const createdAt = new Date().toISOString();
  const optInAt = input.optIn ? createdAt : null;

  if (isDemoMode()) {
    const state = await readDemoState();
    const current = assembleDemoCustomers(state);
    if (phoneTaken(current, phone)) throw new Error("Esse WhatsApp já está na base.");
    if (state.extras.length >= DEMO_IMPORT_CAP) {
      throw new Error("Modo demonstração — limite de 25 contatos manuais.");
    }
    const customer: Customer = {
      id: `imp-${digitsOnly(phone)}-${Date.now()}`,
      restaurantId,
      name,
      phone,
      lastPurchaseAt,
      optIn: input.optIn,
      optInAt,
      optInSource: input.optInSource?.trim() ?? null,
      optInProof: input.optInProof?.trim() ?? null,
      createdAt,
    };
    await writeDemoState({ ...state, extras: [customer, ...state.extras] });
    return withSegment(customer);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");

  const { data: existing } = await admin
    .from("customers")
    .select("id, phone")
    .eq("restaurant_id", restaurantId);
  if (phoneTaken(existing ?? [], phone)) {
    throw new Error("Esse WhatsApp já está na base.");
  }

  const { data, error } = await admin
    .from("customers")
    .insert({
      restaurant_id: restaurantId,
      name,
      phone,
      last_purchase_at: lastPurchaseAt,
      opt_in: input.optIn,
      opt_in_at: optInAt,
      opt_in_source: input.optIn ? input.optInSource?.trim() : null,
      opt_in_proof: input.optIn ? input.optInProof?.trim() : null,
    })
    .select(
      "id, restaurant_id, name, phone, last_purchase_at, opt_in, opt_in_at, opt_in_source, opt_in_proof, created_at",
    )
    .single();
  if (error || !data) throw new Error("Não foi possível salvar o cliente.");
  return withSegment(mapRow(data));
}

export async function updateCustomer(restaurantId: string, id: string, input: CustomerInput) {
  const phone = requirePhone(input.phone);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Informe o nome do cliente.");
  if (input.optIn && (!input.optInSource?.trim() || !input.optInProof?.trim())) {
    throw new Error("Opt-in exige origem e comprovante auditável.");
  }
  const visitAt = parseVisitAt(input.lastVisitAt);
  const optInAt = input.optIn ? new Date().toISOString() : null;

  if (isDemoMode()) {
    const state = await readDemoState();
    const current = assembleDemoCustomers(state);
    const existing = current.find((customer) => customer.id === id);
    if (!existing) throw new Error("Cliente não encontrado.");
    if (phoneTaken(current, phone, id)) throw new Error("Esse WhatsApp já está na base.");
    const next: Customer = {
      ...existing,
      name,
      phone,
      lastPurchaseAt: visitAt ?? existing.lastPurchaseAt,
      optIn: input.optIn,
      optInAt: input.optIn ? existing.optInAt ?? optInAt : null,
      optInSource: input.optIn ? input.optInSource?.trim() ?? null : null,
      optInProof: input.optIn ? input.optInProof?.trim() ?? null : null,
    };
    await writeDemoState({
      ...state,
      extras: state.extras.map((customer) => (customer.id === id ? next : customer)),
      overrides: { ...state.overrides, [id]: next },
    });
    return withSegment(next);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");

  const { data: siblings } = await admin
    .from("customers")
    .select("id, phone")
    .eq("restaurant_id", restaurantId);
  if (phoneTaken(siblings ?? [], phone, id)) {
    throw new Error("Esse WhatsApp já está na base.");
  }

  const { data, error } = await admin
    .from("customers")
    .update({
      name,
      phone,
      ...(visitAt ? { last_purchase_at: visitAt } : {}),
      opt_in: input.optIn,
      opt_in_at: input.optIn ? optInAt : null,
      opt_in_source: input.optIn ? input.optInSource?.trim() : null,
      opt_in_proof: input.optIn ? input.optInProof?.trim() : null,
    })
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .select(
      "id, restaurant_id, name, phone, last_purchase_at, opt_in, opt_in_at, opt_in_source, opt_in_proof, created_at",
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cliente não encontrado.");
  return withSegment(mapRow(data));
}

export async function deleteCustomer(restaurantId: string, id: string) {
  if (isDemoMode()) {
    const state = await readDemoState();
    const current = assembleDemoCustomers(state);
    if (!current.some((customer) => customer.id === id)) {
      throw new Error("Cliente não encontrado.");
    }
    await writeDemoState({
      extras: state.extras.filter((customer) => customer.id !== id),
      overrides: Object.fromEntries(
        Object.entries(state.overrides).filter(([key]) => key !== id),
      ),
      deleted: state.deleted.includes(id) ? state.deleted : [...state.deleted, id],
    });
    return { ok: true as const };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");

  const { data, error } = await admin
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cliente não encontrado.");
  return { ok: true as const };
}

export async function registerVisit(restaurantId: string, customerId: string) {
  const now = new Date().toISOString();
  if (isDemoMode()) {
    const state = await readDemoState();
    const current = assembleDemoCustomers(state);
    const existing = current.find((customer) => customer.id === customerId);
    if (!existing) throw new Error("Cliente não encontrado.");
    const next: Customer = { ...existing, lastPurchaseAt: now };
    await writeDemoState({
      ...state,
      extras: state.extras.map((customer) => (customer.id === customerId ? next : customer)),
      overrides: { ...state.overrides, [customerId]: next },
    });
    return withSegment(next);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível.");
  const { data, error } = await admin
    .from("customers")
    .update({ last_purchase_at: now })
    .eq("id", customerId)
    .eq("restaurant_id", restaurantId)
    .select(
      "id, restaurant_id, name, phone, last_purchase_at, opt_in, opt_in_at, opt_in_source, opt_in_proof, created_at",
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cliente não encontrado.");
  return withSegment(mapRow(data));
}

export async function listOptedInBySegment(segment: RecencySegment, restaurantId: string) {
  const customers = await listCustomers(segment, restaurantId);
  return customers.filter((customer) =>
    hasProvenOptIn({
      optIn: customer.optIn,
      optInAt: customer.optInAt,
      optInSource: customer.optInSource,
      optInProof: customer.optInProof,
    }),
  );
}

export function demoRestaurantId() {
  return DEMO_RESTAURANT_ID;
}
