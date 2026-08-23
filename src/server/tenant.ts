import {
  BackendUnavailableError,
  DEMO_RESTAURANT_ID,
  isDemoMode,
  isSupabaseConfigured,
  requireLiveBackend,
} from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthRequiredError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
    this.name = "AuthRequiredError";
  }
}

export class StoreRequiredError extends Error {
  constructor() {
    super("STORE_REQUIRED");
    this.name = "StoreRequiredError";
  }
}

export async function getCurrentUserId() {
  if (!isSupabaseConfigured()) return null;

  const server = await createSupabaseServerClient();
  if (!server) return null;

  const {
    data: { user },
  } = await server.auth.getUser();
  return user?.id ?? null;
}

export async function getCurrentRestaurantId() {
  if (isDemoMode()) return DEMO_RESTAURANT_ID;

  requireLiveBackend();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new BackendUnavailableError();
  }

  const server = await createSupabaseServerClient();
  const user = server ? (await server.auth.getUser()).data.user : null;

  if (!user) {
    throw new AuthRequiredError();
  }

  const { data } = await admin
    .from("restaurants")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (data?.id) return data.id as string;
  throw new StoreRequiredError();
}
