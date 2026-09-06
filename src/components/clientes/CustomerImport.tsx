"use client";

import { useState, type ReactNode } from "react";
import { btnPrimaryClass, btnSecondaryClass } from "@/components/ui/tokens";
import type { AudienceWithCount } from "@/lib/audiences/types";
import type { ListFreshness } from "@/lib/customers/list-freshness";
import type { ParsedCustomerRow } from "@/lib/customers/parse-sheet";
import { daysSince } from "@/lib/segments/recency";
import { formatWhatsAppPhone } from "@/lib/whatsapp/display";
import type { Customer } from "@/types/database";

export type CustomerBoardSnapshot = {
  customers?: Customer[];
  audiences?: AudienceWithCount[];
  freshness?: ListFreshness;
};

type AnalyzePayload = {
  error?: string;
  previewLabel?: string;
  notes?: string[];
  rejected?: string[];
  invalid?: number;
  rows?: ParsedCustomerRow[];
  count?: number;
  aiReady?: boolean;
};

export function CustomerImport({
  onImported,
  trailingActions,
}: {
  onImported?: (snapshot: CustomerBoardSnapshot) => void | Promise<void>;
  /** Botões na mesma linha do Importar (Excluir / Adicionar). */
  trailingActions?: ReactNode;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<{
    label: string;
    notes: string[];
    rejected: string[];
    rows: ParsedCustomerRow[];
  } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    setPreview(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", "analyze");
      const response = await fetch("/api/customers/import", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const payload = (await response.json()) as AnalyzePayload;
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível interpretar o ficheiro");
      const rows = payload.rows ?? [];
      if (rows.length === 0) {
        throw new Error(payload.error ?? "Não encontrei clientes com telefone neste ficheiro.");
      }
      setPreview({
        label: payload.previewLabel ?? `${rows.length} contacto(s)`,
        notes: payload.notes ?? [],
        rejected: payload.rejected ?? [],
        rows,
      });
      setStatus("Pré-visualização pronta. Confirme para gravar na base.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha na leitura inteligente");
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!preview?.rows.length) return;
    setConfirming(true);
    setStatus(null);
    try {
      const response = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows }),
        cache: "no-store",
      });
      const payload = (await response.json()) as CustomerBoardSnapshot & {
        error?: string;
        imported?: number;
        updated?: number;
        invalid?: number;
      };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível importar");
      setStatus(
        `Novos ${payload.imported ?? 0}. Atualizados ${payload.updated ?? 0}. Inválidos ${payload.invalid ?? 0}.`,
      );
      setPreview(null);
      await onImported?.({
        customers: payload.customers ?? [],
        audiences: payload.audiences,
        freshness: payload.freshness,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha na importação");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btnSecondaryClass} cursor-pointer shrink-0`}>
          {loading ? "A interpretar…" : "Importar base"}
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,text/csv,text/plain,application/pdf,image/png,image/jpeg,image/webp,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            disabled={loading || confirming}
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {trailingActions}
        <a
          href="/modelos/clientes.csv"
          download
          className="shrink-0 text-xs font-medium text-emerald-700 hover:underline"
        >
          Modelo CSV
        </a>
      </div>
      <p className="text-[11px] text-[#667781]">
        Excel/CSV: nome, WhatsApp, pedidos, dias sem pedir. PDF/foto usam etapa própria.
      </p>

      {preview ? (
        <div className="rounded-xl border border-[#E9EDEF] bg-[#F0F2F5]/60 p-3">
          <p className="text-sm font-semibold text-[#111B21]">{preview.label}</p>
          {preview.notes.length ? (
            <p className="mt-1 text-xs text-[#667781]">{preview.notes.slice(0, 3).join(" · ")}</p>
          ) : null}
          {preview.rejected.length ? (
            <p className="mt-1 text-xs text-amber-800">
              Avisos: {preview.rejected.slice(0, 4).join(" · ")}
            </p>
          ) : null}

          <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-[#E9EDEF] bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#F0F2F5] text-[#667781]">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Nome</th>
                  <th className="px-2 py-1.5 font-medium">WhatsApp</th>
                  <th className="px-2 py-1.5 font-medium">Pedidos</th>
                  <th className="px-2 py-1.5 font-medium">Dias sem pedir</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 40).map((row) => {
                  const days = row.lastPurchaseAt ? daysSince(row.lastPurchaseAt) : null;
                  return (
                    <tr key={row.phone} className="border-t border-[#E9EDEF]">
                      <td className="px-2 py-1.5 text-[#111B21]">{row.name}</td>
                      <td className="px-2 py-1.5 text-[#111B21]">
                        {formatWhatsAppPhone(row.phone) ?? row.phone}
                      </td>
                      <td className="px-2 py-1.5 text-[#111B21]">
                        {row.orderCount !== null && row.orderCount !== undefined
                          ? row.orderCount
                          : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-[#111B21]">
                        {days !== null && Number.isFinite(days) ? days : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 40 ? (
            <p className="mt-1 text-[11px] text-[#667781]">
              A mostrar 40 de {preview.rows.length}. Todos entram na confirmação.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimaryClass}
              disabled={confirming}
              onClick={() => void confirmImport()}
            >
              {confirming ? "A gravar…" : `Confirmar e importar ${preview.rows.length}`}
            </button>
            <button
              type="button"
              className={btnSecondaryClass}
              disabled={confirming}
              onClick={() => {
                setPreview(null);
                setStatus(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {status ? <p className="max-w-[640px] text-xs text-[#667781]">{status}</p> : null}
    </div>
  );
}
