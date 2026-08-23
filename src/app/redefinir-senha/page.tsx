import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    redirect("/recuperar-senha");
  }

  return (
    <AuthShell title="Nova senha" subtitle="Defina a senha que você vai usar no painel da loja.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
