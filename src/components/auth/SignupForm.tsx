"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signupSchema, onboardingSchema } from "@/lib/validations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { btnPrimaryClass, inputClass, labelClass, labelTextClass } from "@/components/ui/tokens";

type SignupFormProps = {
  completeOnly?: boolean;
  initialStoreName?: string;
  initialCity?: string;
};

function signupErrorMessage(message: string) {
  if (message.toLowerCase().includes("already registered")) {
    return "Este e-mail já tem conta. Entre ou recupere a senha.";
  }
  return message;
}

export function SignupForm({
  completeOnly = false,
  initialStoreName = "",
  initialCity = "",
}: SignupFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState(initialStoreName);
  const [city, setCity] = useState(initialCity);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function finishOnboarding(name: string, storeCity: string) {
    const response = await fetch("/api/auth/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeName: name, city: storeCity }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Não foi possível criar a loja.");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (completeOnly) {
      const parsed = onboardingSchema.safeParse({ storeName, city });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
        return;
      }

      setLoading(true);
      try {
        await finishOnboarding(parsed.data.storeName, parsed.data.city);
        router.push("/");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Não foi possível concluir o cadastro.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const parsed = signupSchema.safeParse({ email, password, storeName, city });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: {
            store_name: parsed.data.storeName,
            city: parsed.data.city,
          },
        },
      });

      if (signUpError) {
        setError(signupErrorMessage(signUpError.message));
        return;
      }

      if (!data.session) {
        setInfo(
          "Enviamos um e-mail de confirmação. Abra o link e você volta para esta tela de login. Entre com o mesmo e-mail e senha.",
        );
        return;
      }

      await finishOnboarding(parsed.data.storeName, parsed.data.city);
      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {!completeOnly ? (
        <>
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
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </label>
        </>
      ) : null}

      <label className={labelClass}>
        <span className={labelTextClass}>Nome da loja</span>
        <input
          type="text"
          autoComplete="organization"
          className={inputClass}
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          placeholder="Digite o nome do seu restaurante"
          required
        />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Cidade</span>
        <input
          type="text"
          autoComplete="address-level2"
          className={inputClass}
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="Digite a cidade do seu restaurante"
          required
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {info ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </p>
      ) : null}

      <button type="submit" className={`${btnPrimaryClass} w-full`} disabled={loading}>
        {loading ? "Salvando…" : completeOnly ? "Criar loja" : "Criar conta"}
      </button>
    </form>
  );
}
