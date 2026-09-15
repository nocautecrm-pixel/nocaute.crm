import { AsyncLocalStorage } from "node:async_hooks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/config";

const tenants = new AsyncLocalStorage<string>();
export class ImportBudgetError extends Error {}

export function withImportTenant<T>(restaurantId: string, work: () => Promise<T>) {
  return tenants.run(restaurantId, work);
}

export async function withImportBudget<T>(kind: "import" | "ai", work: () => Promise<T>): Promise<T> {
  if (isDemoMode() && kind === "import") return work();
  const restaurantId = tenants.getStore();
  const admin = createSupabaseAdminClient();
  if (!restaurantId || !admin) throw new ImportBudgetError("Importação indisponível: limite não verificado.");
  const { data: token, error } = await admin.rpc("claim_import_budget", {
    p_restaurant_id: restaurantId, p_kind: kind,
  });
  if (error || !token) throw new ImportBudgetError("Importação ocupada ou limite diário atingido. Tente mais tarde.");
  try {
    return await work();
  } finally {
    // Release only this lease. A failed cleanup expires conservatively; it does
    // not refund spent requests or unlock a newer request.
    await admin.rpc("release_import_budget", {
      p_restaurant_id: restaurantId, p_kind: kind, p_token: token,
    }).then(({ error }) => { if (error) console.error("import_budget_release_failed"); });
  }
}
