"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLink } from "@/components/auth/AuthShell";
import { loginSchema } from "@/lib/validations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/auth/paths";
import { btnPrimaryClass, inputClass, labelClass, labelTextClass } from "@/components/ui/tokens";

function loginQueryMessage(error: string | null) {
  if (error === "link") return "Link inválido ou expirado. Entre de novo ou peça outro e-mail.";
  return null;
}

function loginQueryInfo(confirmed: string | null) {
  if (confirmed === "1") {
    return "E-mail confirmado. Entre com o e-mail e a senha da conta que você acabou de criar.";
  }
  return null;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get("next"), "/");
  const queryError = loginQueryMessage(searchParams.get("error"));
  const queryInfo = loginQueryInfo(searchParams.get("confirmed"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(queryError);
  const [info] = useState<string | null>(queryInfo);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
      if (signInError) {
        setError(
          signInError.message.includes("Invalid login credentials")
            ? "E-mail ou senha incorretos."
            : signInError.message.includes("Email not confirmed")
              ? "Confirme o e-mail que enviamos antes de entrar."
              : signInError.message,
        );
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className={labelClass}>
        <span className={labelTextClass}>E-mail</span>
        <input
          type="email"
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Digite o e-mail da sua loja"
          required
        />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          className={inputClass}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Digite a senha"
          required
        />
      </label>

      <p className="text-right text-sm">
        <AuthLink href="/recuperar-senha">Esqueci a senha</AuthLink>
      </p>

      {info && !error ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button type="submit" className={`${btnPrimaryClass} w-full`} disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
