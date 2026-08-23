import { Suspense } from "react";
import { AuthLink, AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse o painel da sua loja."
      footer={
        <>
          Ainda não tem conta? <AuthLink href="/cadastro">Criar conta</AuthLink>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-[#667781]">Carregando…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
