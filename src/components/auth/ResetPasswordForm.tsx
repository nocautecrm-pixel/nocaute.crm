"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordSchema } from "@/lib/validations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { btnPrimaryClass, inputClass, labelClass, labelTextClass } from "@/components/ui/tokens";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Não foi possível salvar a senha nova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className={labelClass}>
        <span className={labelTextClass}>Nova senha</span>
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

      <label className={labelClass}>
        <span className={labelTextClass}>Confirmar senha</span>
        <input
          type="password"
          autoComplete="new-password"
          className={inputClass}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repita a senha"
          minLength={8}
          required
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button type="submit" className={`${btnPrimaryClass} w-full`} disabled={loading}>
        {loading ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
