import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { RecoverPasswordForm } from "@/components/auth/RecoverPasswordForm";

export default function RecoverPasswordPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviamos um link para o e-mail da conta da loja."
      footer={
        <>
          Lembrou a senha? <AuthLink href="/login">Entrar</AuthLink>
        </>
      }
    >
      <RecoverPasswordForm />
    </AuthShell>
  );
}
