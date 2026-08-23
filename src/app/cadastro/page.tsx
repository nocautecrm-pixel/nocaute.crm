import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export default function CadastroPage() {
  return (
    <AuthShell
      title="Criar conta"
      subtitle="Cadastre sua loja e comece a reativar clientes no WhatsApp."
      footer={
        <>
          Já tem conta? <AuthLink href="/login">Entrar</AuthLink>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
