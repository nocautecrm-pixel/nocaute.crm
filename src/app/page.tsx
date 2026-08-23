import { redirect } from "next/navigation";
import { BackendUnavailableError, isDemoMode, isLiveBackendReady } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorePanel } from "@/server/store";
import { StoreRequiredError } from "@/server/tenant";

export default async function HomePage() {
  if (!isLiveBackendReady()) {
    if (!isDemoMode()) {
      redirect("/indisponivel");
    }
    const store = await getStorePanel();
    redirect(store.whatsapp.connected ? "/visao-geral" : "/configuracoes");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    redirect("/login");
  }

  try {
    const store = await getStorePanel();
    redirect(store.whatsapp.connected ? "/visao-geral" : "/configuracoes");
  } catch (error) {
    if (error instanceof StoreRequiredError) {
      redirect("/completar-cadastro");
    }
    if (error instanceof BackendUnavailableError) {
      redirect("/indisponivel");
    }
    throw error;
  }
}
