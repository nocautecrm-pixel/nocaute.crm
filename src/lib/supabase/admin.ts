import { createClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured } from "@/lib/config";

export function createSupabaseAdminClient() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseAdminConfigured() || !serviceRole) {
    return null;
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
