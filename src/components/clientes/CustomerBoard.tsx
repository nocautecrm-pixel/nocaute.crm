"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CustomerImport } from "@/components/clientes/CustomerImport";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
  labelTextClass,
} from "@/components/ui/tokens";
import { RECENCY_SEGMENTS, daysSince, isOutsideCampaignWindow, segmentForDays, situationLabel } from "@/lib/segments/recency";
import { hasProvenOptIn, OPT_IN_SOURCE_LABELS, type OptInSource } from "@/lib/customers/opt-in";
import { formatWhatsAppPhone } from "@/lib/whatsapp/display";
import type { Customer, RecencySegment } from "@/types/database";

type Draft = {
  name: string;
  phone: string;
  lastVisitAt: string;
  optIn: boolean;
  optInSource: OptInSource | "";
  optInProof: string;
};

function toDraft(customer: Customer): Draft {
  return {
    name: customer.name,
    phone: formatWhatsAppPhone(customer.phone) ?? customer.phone,
    lastVisitAt: customer.lastPurchaseAt ? customer.lastPurchaseAt.slice(0, 10) : "",
    optIn: customer.optIn,
    optInSource: (customer.optInSource as OptInSource) ?? "",
    optInProof: customer.optInProof ?? "",
  };
}

const emptyDraft = (): Draft => ({
  name: "",
  phone: "",
  lastVisitAt: new Date().toISOString().slice(0, 10),
  optIn: true,
  optInSource: "balcao",
  optInProof: "",
});

export function CustomerBoard({
  customers,
  demo,
  segmento,
}: {
  customers: Customer[];
  demo: boolean;
  segmento?: RecencySegment;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => customers.find((customer) => customer.id === selectedId) ?? null,
    [customers, selectedId],
  );
  const editorOpen = creating || Boolean(selected);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setDraft(emptyDraft());
    setStatus(null);
  }

  function openEdit(customer: Customer) {
    setCreating(false);
    setSelectedId(customer.id);
    setDraft(toDraft(customer));
    setStatus(null);
  }

  function closeEditor() {
    setCreating(false);
    setSelectedId(null);
    setStatus(null);
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const path = creating ? "/api/customers" : `/api/customers/${selectedId}`;
      const response = await fetch(path, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar");
      setCreating(false);
      setStatus("Salvo.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function onVisit() {
    if (!selectedId || creating) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/customers/${selectedId}/visit`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não registrou a visita");
      setStatus("Visita de hoje registrada.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao registrar visita");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedId || creating) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/customers/${selectedId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir");
      closeEditor();
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <FilterChip href="/clientes" active={!segmento} label="Todos" />
          {(Object.keys(RECENCY_SEGMENTS) as RecencySegment[]).map((key) => (
            <FilterChip
              key={key}
              href={`/clientes?segmento=${key}`}
              active={segmento === key}
              label={RECENCY_SEGMENTS[key].label}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomerImport />
          <button type="button" onClick={openCreate} className={btnPrimaryClass}>
            Adicionar cliente
          </button>
        </div>
      </div>

      {demo ? (
        <p className="shrink-0 text-xs text-[#667781]">
          Modo demonstração — até 25 contatos manuais neste navegador.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className={`min-h-0 min-w-0 flex-1 overflow-hidden ${cardClass}`}>
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-white text-[11px] font-medium uppercase tracking-[0.14em] text-[#667781]">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">WhatsApp</th>
                  <th className="px-4 py-2">Sumiu há</th>
                  <th className="px-4 py-2">Situação</th>
                  <th className="px-4 py-2">Opt-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9EDEF]">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#667781]">
                      Importe a base ou adicione um cliente na mão.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => {
                    const days = daysSince(customer.lastPurchaseAt);
                    const active = customer.id === selectedId;
                    return (
                      <tr
                        key={customer.id}
                        className={`cursor-pointer ${active ? "bg-emerald-50" : "hover:bg-[#F5F6F6]"}`}
                        onClick={() => openEdit(customer)}
                      >
                        <td className="px-4 py-2.5 font-medium tracking-tight text-[#111B21]">
                          {customer.name}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#667781]">
                          {formatWhatsAppPhone(customer.phone) ?? customer.phone}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[#111B21]">
                          {days === Number.POSITIVE_INFINITY ? "—" : `${days} dias`}
                        </td>
                        <td className="px-4 py-2.5 text-[#667781]">
                          {situationLabel(days)}
                        </td>
                        <td className="px-4 py-2.5">
                          {hasProvenOptIn(customer) ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <StatusDot tone="live" />
                              Comprovado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[11px] font-medium text-[#667781]">
                              <StatusDot tone="idle" />
                              Sem permissão
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {editorOpen ? (
          <form
            onSubmit={onSave}
            className={`${cardClass} flex w-full shrink-0 flex-col gap-3 overflow-y-auto p-4 lg:w-[320px]`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#111B21]">
                  {creating ? "Novo cliente" : "Editar cliente"}
                </p>
                <p className="text-xs text-[#667781]">
                  Mudar a situação coloca o contato na faixa da próxima campanha.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="text-xs font-medium text-[#667781] hover:text-[#111B21]"
              >
                Fechar
              </button>
            </div>

            <label className={labelClass}>
              <span className={labelTextClass}>Nome</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className={inputClass}
                required
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>WhatsApp</span>
              <input
                value={draft.phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                className={inputClass}
                placeholder="(11) 98888-0000"
                required
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Última visita</span>
              <input
                type="date"
                value={draft.lastVisitAt}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, lastVisitAt: event.target.value }))
                }
                className={inputClass}
                required
              />
              <span className="text-xs text-[#667781]">
                O segmento sai dessa data. Não invente faixa no lugar da visita.
                {selected ? ` ID: ${selected.id}` : null}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-[#111B21]">
              <input
                type="checkbox"
                checked={draft.optIn}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, optIn: event.target.checked }))
                }
                className="h-4 w-4 rounded border-[#E9EDEF] text-emerald-600"
              />
              Pode receber campanha
            </label>
            {draft.optIn ? (
              <>
                <label className={labelClass}>
                  <span className={labelTextClass}>Origem do opt-in</span>
                  <select
                    value={draft.optInSource}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        optInSource: event.target.value as OptInSource,
                      }))
                    }
                    className={inputClass}
                    required
                  >
                    {Object.entries(OPT_IN_SOURCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Comprovante (nº pedido, reserva…)</span>
                  <input
                    value={draft.optInProof}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, optInProof: event.target.value }))
                    }
                    className={inputClass}
                    placeholder="PDV-1042"
                    required
                  />
                </label>
              </>
            ) : null}

            <div className="mt-auto flex flex-col gap-2">
              <button type="submit" disabled={saving} className={btnPrimaryClass}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
              {!creating ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onVisit()}
                    disabled={saving}
                    className={btnSecondaryClass}
                  >
                    Veio hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    disabled={saving}
                    className={`${btnSecondaryClass} text-red-600`}
                  >
                    Excluir
                  </button>
                </>
              ) : null}
              {status ? <p className="text-xs text-[#667781]">{status}</p> : null}
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm tracking-tight ${
        active
          ? "bg-[#111B21] font-semibold text-white"
          : "border border-[#E9EDEF] bg-white font-medium text-[#667781] hover:bg-[#F0F2F5]"
      }`}
    >
      {label}
    </Link>
  );
}
