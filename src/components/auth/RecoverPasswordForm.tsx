"use client";

import { useState } from "react";
import { recoverPasswordSchema } from "@/lib/validations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { btnPrimaryClass, inputClass, labelClass, labelTextClass } from "@/components/ui/tokens";

export function RecoverPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const parsed = recoverPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "E-mail inválido");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setInfo("Se este e-mail tiver conta, enviamos o link para definir uma senha nova.");
    } catch {
      setError("Não foi possível enviar o e-mail. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className={labelClass}>
        <span className={labelTextClass}>E-mail da conta</span>
        <input
          type="email"
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@loja.com"
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
        {loading ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}
