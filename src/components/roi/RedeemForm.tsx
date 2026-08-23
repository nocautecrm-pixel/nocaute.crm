"use client";

import { useState } from "react";
import { btnPrimaryClass, cardClass, inputClass } from "@/components/ui/tokens";

export function RedeemForm() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json()) as {
        error?: string;
        ok?: boolean;
        reason?: string;
        message?: string;
        demo?: boolean;
      };
      if (!response.ok) throw new Error(payload.error ?? "Cupom inválido");
      if (payload.ok === false) {
        const map = {
          not_found: "Cupom não encontrado",
          already_redeemed: "Este cupom já foi usado",
          expired: "Cupom expirado",
        };
        setStatus(map[payload.reason as keyof typeof map] ?? "Não foi possível validar");
        return;
      }
      setStatus(payload.message ?? "Cupom registrado. Cliente voltou.");
      setCode("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${cardClass} flex h-full flex-col space-y-3 p-5`}>
      <h2 className="text-sm font-semibold tracking-tight text-slate-900">
        O cliente usou o cupom no salão?
      </h2>
      <p className="text-sm text-slate-500">
        Digite o código. O WhatsApp também detecta sozinho quando a pessoa responde com o cupom.
      </p>
      <input
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="MF-XXXXXX"
        className={`${inputClass} font-mono`}
      />
      <button type="submit" disabled={loading || !code} className={btnPrimaryClass}>
        {loading ? "Validando…" : "Registrar uso"}
      </button>
      {status ? <p className="text-sm text-slate-500">{status}</p> : null}
    </form>
  );
}
