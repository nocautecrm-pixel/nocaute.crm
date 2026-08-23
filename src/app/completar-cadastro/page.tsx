import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storeDraftFromUserMetadata } from "@/server/restaurant-provision";

export default async function CompletarCadastroPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    redirect("/login");
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data } = await admin
      .from("restaurants")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (data?.id) {
      redirect("/");
    }
  }

  const draft = storeDraftFromUserMetadata(user.user_metadata);

  return (
    <AuthShell
      title="Configurar loja"
      subtitle="Sua conta existe. Falta só o nome e a cidade da casa."
    >
      <SignupForm
        completeOnly
        initialStoreName={draft.storeName}
        initialCity={draft.city}
      />
    </AuthShell>
  );
}
