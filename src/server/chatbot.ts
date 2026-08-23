import { cookies } from "next/headers";
import { DEFAULT_BRAND_DNA, type BrandDna } from "@/lib/chatbot/dna";
import { BackendUnavailableError, isDemoMode, requireLiveBackend } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { brandDnaSchema } from "@/lib/validations";
import { getCurrentRestaurantId } from "@/server/tenant";

export const DEMO_DNA_COOKIE = "brand_dna";

function parseDna(value: unknown): BrandDna {
  const parsed = brandDnaSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_BRAND_DNA;
}

function dnaFromCookie(raw: string | undefined) {
  if (!raw) return DEFAULT_BRAND_DNA;
  try {
    return parseDna(JSON.parse(raw));
  } catch {
    return DEFAULT_BRAND_DNA;
  }
}

export async function getBrandDna(): Promise<BrandDna> {
  if (isDemoMode()) {
    const jar = await cookies();
    return dnaFromCookie(jar.get(DEMO_DNA_COOKIE)?.value);
  }

  const restaurantId = await getCurrentRestaurantId();
  return getBrandDnaForRestaurant(restaurantId);
}

export async function getBrandDnaForRestaurant(restaurantId: string): Promise<BrandDna> {
  if (isDemoMode()) return DEFAULT_BRAND_DNA;

  requireLiveBackend();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const { data } = await admin
    .from("chatbot_profiles")
    .select("personality, tone, detail_level, emojis, greeting")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!data) return DEFAULT_BRAND_DNA;

  return parseDna({
    personality: data.personality,
    tone: data.tone,
    detailLevel: data.detail_level,
    emojis: data.emojis,
    greeting: data.greeting,
  });
}

export async function saveBrandDna(input: BrandDna) {
  const dna = parseDna(input);

  if (isDemoMode()) {
    const jar = await cookies();
    jar.set(DEMO_DNA_COOKIE, JSON.stringify(dna), { path: "/", sameSite: "lax" });
    return { ok: true as const, demo: true as const, dna };
  }

  requireLiveBackend();
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const restaurantId = await getCurrentRestaurantId();
  const now = new Date().toISOString();
  const { error } = await admin.from("chatbot_profiles").upsert(
    {
      restaurant_id: restaurantId,
      personality: dna.personality,
      tone: dna.tone,
      detail_level: dna.detailLevel,
      emojis: dna.emojis,
      greeting: dna.greeting,
      updated_at: now,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) throw error;
  return { ok: true as const, demo: false as const, dna };
}
