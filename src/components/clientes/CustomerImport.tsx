"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnSecondaryClass } from "@/components/ui/tokens";

export function CustomerImport() {
  const router = useRouter();
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
      });
      const payload = (await response.json()) as {
        error?: string;
        imported?: number;
        duplicates?: number;
        invalid?: number;
        rejected?: string[];
      };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível importar");
      const rejectedNote =
        payload.rejected?.length ? ` Rejeitados: ${payload.rejected.join(" · ")}` : "";
      setStatus(
        `Importados ${payload.imported ?? 0}. Duplicados ${payload.duplicates ?? 0}. Inválidos ${payload.invalid ?? 0}.${rejectedNote}`,
      );
      router.refresh();
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
          accept=".csv,text/csv"
          className="hidden"
          disabled={loading}
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <a href="/modelos/clientes.csv" download className="text-sm font-medium text-emerald-700 hover:underline">
        Baixar modelo CSV
      </a>
      {status ? <p className="max-w-[220px] truncate text-xs text-[#667781]">{status}</p> : null}
    </div>
  );
}
