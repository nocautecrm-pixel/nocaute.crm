"use client";

import { useState } from "react";
import { btnPrimaryClass, cardClass, inputClass, labelClass, labelTextClass } from "@/components/ui/tokens";

export function CashierDesk() {
  const [coupon, setCoupon] = useState("");
  const [couponStatus, setCouponStatus] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [visitStatus, setVisitStatus] = useState<string | null>(null);
  const [savingVisit, setSavingVisit] = useState(false);

  async function onRedeem(event: React.FormEvent) {
    event.preventDefault();
    setRedeeming(true);
    setCouponStatus(null);
    try {
      const response = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon }),
      });
      const payload = (await response.json()) as {
        error?: string;
        ok?: boolean;
        code?: string;
        reason?: string;
        demo?: boolean;
      };
      if (!response.ok) throw new Error(payload.error ?? "Cupom inválido");
      if (payload.demo) {
        setCouponStatus("Modo demo: cupom aceito sem gravar.");
        return;
      }
      if (!payload.ok) {
        const map: Record<string, string> = {
          not_found: "Cupom não é desta loja.",
          already_redeemed: "Cupom já foi usado.",
          expired: "Cupom expirado.",
        };
        throw new Error(map[payload.reason ?? ""] ?? "Cupom inválido");
      }
      setCoupon("");
      setCouponStatus(`Cupom ${payload.code} resgatado. Visita registrada.`);
    } catch (error) {
      setCouponStatus(error instanceof Error ? error.message : "Falha no resgate");
    } finally {
      setRedeeming(false);
    }
  }

  async function onVisit(event: React.FormEvent) {
    event.preventDefault();
    setSavingVisit(true);
    setVisitStatus(null);
    try {
      const response = await fetch(`/api/customers/${customerId.trim()}/visit`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; customer?: { name: string } };
      if (!response.ok) throw new Error(payload.error ?? "Não registrou a visita");
      setVisitStatus(`Visita de ${payload.customer?.name ?? "cliente"} marcada para agora.`);
    } catch (error) {
      setVisitStatus(error instanceof Error ? error.message : "Falha ao registrar visita");
    } finally {
      setSavingVisit(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={onRedeem} className={`${cardClass} space-y-3 p-4`}>
        <h2 className="text-base font-semibold text-[#111B21]">Resgatar cupom</h2>
        <p className="text-sm text-[#667781]">
          Só o login desta loja. O resgate marca a última visita do cliente.
        </p>
        <label className={labelClass}>
          <span className={labelTextClass}>Código</span>
          <input
            value={coupon}
            onChange={(event) => setCoupon(event.target.value.toUpperCase())}
            className={inputClass}
            placeholder="LIMAO15-AB12"
            required
          />
        </label>
        <button type="submit" disabled={redeeming} className={btnPrimaryClass}>
          {redeeming ? "Validando…" : "Validar cupom"}
        </button>
        {couponStatus ? <p className="text-sm text-[#667781]">{couponStatus}</p> : null}
      </form>

      <form onSubmit={onVisit} className={`${cardClass} space-y-3 p-4`}>
        <h2 className="text-base font-semibold text-[#111B21]">Cliente veio sem cupom</h2>
        <p className="text-sm text-[#667781]">
          Cole o ID do cliente (está na ficha em Clientes). Isso muda o segmento pela data real.
        </p>
        <label className={labelClass}>
          <span className={labelTextClass}>ID do cliente</span>
          <input
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className={inputClass}
            required
          />
        </label>
        <button type="submit" disabled={savingVisit} className={btnPrimaryClass}>
          {savingVisit ? "Salvando…" : "Marcar visita hoje"}
        </button>
        {visitStatus ? <p className="text-sm text-[#667781]">{visitStatus}</p> : null}
      </form>
    </div>
  );
}
