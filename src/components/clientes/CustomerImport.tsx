"use client";

import { useState } from "react";
import { btnSecondaryClass } from "@/components/ui/tokens";
import type { AudienceWithCount } from "@/lib/audiences/types";
import type { ListFreshness } from "@/lib/customers/list-freshness";
import type { Customer } from "@/types/database";

export type CustomerBoardSnapshot = {
  customers?: Customer[];
  audiences?: AudienceWithCount[];
  freshness?: ListFreshness;
};

export function CustomerImport({
  onImported,
}: {
  onImported?: (snapshot: CustomerBoardSnapshot) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/customers/import", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const payload = (await response.json()) as CustomerBoardSnapshot & {
        error?: string;
        imported?: number;
        updated?: number;
        duplicates?: number;
        invalid?: number;
        rejected?: string[];
      };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível importar");
      const rejectedNote =
        payload.rejected?.length ? ` Rejeitados: ${payload.rejected.join(" · ")}` : "";
      const updated = payload.updated ?? payload.duplicates ?? 0;
      setStatus(
        `Novos ${payload.imported ?? 0}. Atualizados ${updated}. Inválidos ${payload.invalid ?? 0}.${rejectedNote}`,
      );
      onImported?.({
        customers: payload.customers,
        audiences: payload.audiences,
        freshness: payload.freshness,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha na importação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={`${btnSecondaryClass} cursor-pointer`}>
        {loading ? "Importando…" : "Importar planilha"}
        <input
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={loading}
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <a href="/modelos/clientes.csv" download className="text-sm font-medium text-emerald-700 hover:underline">
        Modelo CSV (opcional)
      </a>
      <p className="max-w-[280px] text-xs text-[#667781]">
        Quantidade só entra se a coluna se chamar exatamente <span className="font-medium text-[#111B21]">pedidos</span>.
      </p>
      {status ? <p className="max-w-[420px] text-xs text-[#667781]">{status}</p> : null}
    </div>
  );
}
