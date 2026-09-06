"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CustomerImport, type CustomerBoardSnapshot } from "@/components/clientes/CustomerImport";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
  labelTextClass,
} from "@/components/ui/tokens";
import { audienceRangeLabel, matchesAudienceDays } from "@/lib/audiences/defaults";
import type { AudienceWithCount } from "@/lib/audiences/types";
import type { ListFreshness } from "@/lib/customers/list-freshness";
import { hasProvenOptIn, OPT_IN_SOURCE_LABELS, type OptInSource } from "@/lib/customers/opt-in";
import { daysSince, RECENCY_SEGMENTS, segmentForDays } from "@/lib/segments/recency";
import { formatWhatsAppPhone } from "@/lib/whatsapp/display";
import type { Customer } from "@/types/database";

type Draft = {
  name: string;
  phone: string;
  lastVisitAt: string;
  orderCount: string;
  optIn: boolean;
  optInSource: OptInSource | "";
  optInProof: string;
};

type AudienceDraft = {
  id?: string;
  name: string;
  minDays: number;
  maxDays: number;
  isDefault: boolean;
};

function toDraft(customer: Customer): Draft {
  return {
    name: customer.name,
    phone: formatWhatsAppPhone(customer.phone) ?? customer.phone,
    lastVisitAt: customer.lastPurchaseAt ? customer.lastPurchaseAt.slice(0, 10) : "",
    orderCount: String(customer.orderCount ?? 0),
    optIn: customer.optIn,
    optInSource: (customer.optInSource as OptInSource) ?? "",
    optInProof: customer.optInProof ?? "",
  };
}

const emptyDraft = (): Draft => ({
  name: "",
  phone: "",
  lastVisitAt: new Date().toISOString().slice(0, 10),
  orderCount: "1",
  optIn: true,
  optInSource: "balcao",
  optInProof: "",
});

export function CustomerBoard({
  customers,
  audiences,
  freshness,
  demo,
  publico,
}: {
  customers: Customer[];
  audiences: AudienceWithCount[];
  freshness: ListFreshness;
  demo: boolean;
  publico?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(customers);
  const [audienceRows, setAudienceRows] = useState(audiences);
  const [listFreshness, setListFreshness] = useState(freshness);
  const [sortKey, setSortKey] = useState<"days" | "orders">("days");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [audienceForm, setAudienceForm] = useState<AudienceDraft | null>(null);
  const [audienceStatus, setAudienceStatus] = useState<string | null>(null);
  const [audienceSaving, setAudienceSaving] = useState(false);

  // RSC/revalidate pode remountar com props novas — mantém a lista alinhada sem F5.
  useEffect(() => {
    setRows(customers);
  }, [customers]);

  useEffect(() => {
    setAudienceRows(audiences);
  }, [audiences]);

  useEffect(() => {
    setListFreshness(freshness);
  }, [freshness]);

  function applyBoard(snapshot: CustomerBoardSnapshot) {
    if (snapshot.customers !== undefined) setRows(snapshot.customers);
    if (snapshot.audiences !== undefined) setAudienceRows(snapshot.audiences);
    if (snapshot.freshness !== undefined) setListFreshness(snapshot.freshness);
  }

  async function reloadBoard() {
    const response = await fetch("/api/customers", { cache: "no-store" });
    const payload = (await response.json()) as CustomerBoardSnapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a lista");
    applyBoard(payload);
  }

  async function handleImported(snapshot: CustomerBoardSnapshot) {
    applyBoard(snapshot);
    try {
      await reloadBoard();
    } catch {
      // Se o GET falhar, mantém o snapshot da resposta do import.
    }
    router.refresh();
  }

  const selectedAudience = audienceRows.find((audience) => audience.slug === publico);
  const visible = useMemo(() => {
    const filtered = selectedAudience
      ? rows.filter((customer) =>
          matchesAudienceDays(
            daysSince(customer.lastPurchaseAt),
            selectedAudience.minDays,
            selectedAudience.maxDays,
          ),
        )
      : rows;
    const sign = sortDir === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => {
      if (sortKey === "orders") {
        return sign * ((left.orderCount ?? 0) - (right.orderCount ?? 0));
      }
      const leftDays = daysSince(left.lastPurchaseAt);
      const rightDays = daysSince(right.lastPurchaseAt);
      const leftValue = Number.isFinite(leftDays) ? leftDays : Number.MAX_SAFE_INTEGER;
      const rightValue = Number.isFinite(rightDays) ? rightDays : Number.MAX_SAFE_INTEGER;
      return sign * (leftValue - rightValue);
    });
  }, [rows, selectedAudience, sortKey, sortDir]);

  function toggleSort(key: "days" | "orders") {
    if (sortKey === key) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  }

  const selected = useMemo(
    () => visible.find((customer) => customer.id === selectedId) ?? null,
    [visible, selectedId],
  );
  const editorOpen = creating || Boolean(selected);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setDraft(emptyDraft());
    setStatus(null);
    setAudienceForm(null);
  }

  function openEdit(customer: Customer) {
    setCreating(false);
    setSelectedId(customer.id);
    setDraft(toDraft(customer));
    setStatus(null);
    setAudienceForm(null);
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
        body: JSON.stringify({
          ...draft,
          orderCount: Number(draft.orderCount) || 0,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar");
      setCreating(false);
      setStatus("Salvo.");
      await reloadBoard();
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
      setDraft((current) => ({
        ...current,
        lastVisitAt: new Date().toISOString().slice(0, 10),
        orderCount: String(Number(current.orderCount || 0) + 1),
      }));
      await reloadBoard();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao registrar visita");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAll() {
    if (rows.length === 0) return;
    const ok = window.confirm(
      `Apaga os ${rows.length} cliente(s) e todo rastro no banco (campanhas, cupons, eventos). Não tem volta. Continuar?`,
    );
    if (!ok) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/customers", { method: "DELETE" });
      const payload = (await response.json()) as CustomerBoardSnapshot & {
        error?: string;
        deleted?: number;
      };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir a lista");
      closeEditor();
      applyBoard(payload);
      setStatus(`Lista apagada (${payload.deleted ?? rows.length}).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao excluir a lista");
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
      await reloadBoard();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveAudience(event: React.FormEvent) {
    event.preventDefault();
    if (!audienceForm) return;
    setAudienceSaving(true);
    setAudienceStatus(null);
    try {
      const creatingAudience = !audienceForm.id;
      const path = creatingAudience ? "/api/audiences" : `/api/audiences/${audienceForm.id}`;
      const response = await fetch(path, {
        method: creatingAudience ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: audienceForm.name,
          minDays: audienceForm.isDefault ? undefined : audienceForm.minDays,
          maxDays: audienceForm.isDefault ? undefined : audienceForm.maxDays,
        }),
      });
      const payload = (await response.json()) as { error?: string; audience?: { slug: string } };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar o público");
      setAudienceForm(null);
      await reloadBoard();
      if (creatingAudience && payload.audience?.slug) {
        router.push(`/clientes?publico=${payload.audience.slug}`);
      }
    } catch (error) {
      setAudienceStatus(error instanceof Error ? error.message : "Erro ao salvar público");
    } finally {
      setAudienceSaving(false);
    }
  }

  async function onDeleteAudience() {
    if (!audienceForm?.id || audienceForm.isDefault) return;
    setAudienceSaving(true);
    setAudienceStatus(null);
    try {
      const response = await fetch(`/api/audiences/${audienceForm.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível apagar");
      setAudienceForm(null);
      router.push("/clientes");
      await reloadBoard();
    } catch (error) {
      setAudienceStatus(error instanceof Error ? error.message : "Erro ao apagar público");
    } finally {
      setAudienceSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ListFreshnessBar freshness={listFreshness} />
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href="/clientes" active={!publico} label="Todos" />
          {audienceRows.map((audience) => (
            <span key={audience.id} className="inline-flex items-center gap-0.5">
              <FilterChip
                href={`/clientes?publico=${audience.slug}`}
                active={publico === audience.slug}
                label={audience.name}
              />
              <button
                type="button"
                onClick={() => {
                  closeEditor();
                  setAudienceStatus(null);
                  setAudienceForm({
                    id: audience.id,
                    name: audience.name,
                    minDays: audience.minDays,
                    maxDays: audience.maxDays,
                    isDefault: audience.isDefault,
                  });
                }}
                className="rounded-md px-1.5 py-1 text-xs font-medium text-[#667781] hover:bg-[#F0F2F5] hover:text-[#111B21]"
                aria-label={`Editar ${audience.name}`}
              >
                Editar
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              closeEditor();
              setAudienceStatus(null);
              setAudienceForm({
                name: "",
                minDays: 31,
                maxDays: 60,
                isDefault: false,
              });
            }}
            className="rounded-lg border border-dashed border-[#E9EDEF] px-3 py-1.5 text-sm font-medium text-[#667781] hover:bg-[#F0F2F5]"
          >
            Novo público
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomerImport onImported={handleImported} />
          {rows.length > 0 ? (
            <button
              type="button"
              onClick={() => void onDeleteAll()}
              disabled={saving}
              className={`${btnSecondaryClass} text-red-600`}
            >
              Excluir lista
            </button>
          ) : null}
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

      {audienceForm ? (
        <form
          onSubmit={onSaveAudience}
          className={`${cardClass} flex shrink-0 flex-wrap items-end gap-3 p-3`}
        >
          <label className={`${labelClass} min-w-[160px] flex-1`}>
            <span className={labelTextClass}>Nome do público</span>
            <input
              value={audienceForm.name}
              onChange={(event) =>
                setAudienceForm((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              className={inputClass}
              placeholder="Ex.: Sumiram no mês"
              required
            />
          </label>
          <label className={`${labelClass} w-24`}>
            <span className={labelTextClass}>De (dias)</span>
            <input
              type="number"
              min={0}
              max={120}
              value={audienceForm.minDays}
              disabled={audienceForm.isDefault}
              onChange={(event) =>
                setAudienceForm((current) =>
                  current ? { ...current, minDays: Number(event.target.value) } : current,
                )
              }
              className={inputClass}
              required
            />
          </label>
          <label className={`${labelClass} w-24`}>
            <span className={labelTextClass}>Até (dias)</span>
            <input
              type="number"
              min={0}
              max={120}
              value={audienceForm.maxDays}
              disabled={audienceForm.isDefault}
              onChange={(event) =>
                setAudienceForm((current) =>
                  current ? { ...current, maxDays: Number(event.target.value) } : current,
                )
              }
              className={inputClass}
              required
            />
          </label>
          <p className="pb-2 text-xs text-[#667781]">
            {audienceForm.isDefault
              ? "Público padrão: só o nome muda. A faixa de dias é fixa."
              : `Filtro ao vivo: ${audienceRangeLabel(audienceForm.minDays, audienceForm.maxDays)} sem pedir.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={audienceSaving} className={btnPrimaryClass}>
              {audienceSaving ? "Salvando…" : "Salvar público"}
            </button>
            {!audienceForm.isDefault && audienceForm.id ? (
              <button
                type="button"
                onClick={() => void onDeleteAudience()}
                disabled={audienceSaving}
                className={`${btnSecondaryClass} text-red-600`}
              >
                Apagar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setAudienceForm(null)}
              className={btnSecondaryClass}
            >
              Cancelar
            </button>
          </div>
          {audienceStatus ? <p className="w-full text-xs text-[#667781]">{audienceStatus}</p> : null}
        </form>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className={`min-h-0 min-w-0 flex-1 overflow-hidden ${cardClass}`}>
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-white text-[11px] font-medium uppercase tracking-[0.14em] text-[#667781]">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">WhatsApp</th>
                  <SortHeader
                    label="Sumiu há"
                    active={sortKey === "days"}
                    direction={sortDir}
                    onClick={() => toggleSort("days")}
                  />
                  <SortHeader
                    label="Pedidos"
                    active={sortKey === "orders"}
                    direction={sortDir}
                    onClick={() => toggleSort("orders")}
                  />
                  <th className="px-4 py-2">Opt-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9EDEF]">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#667781]">
                      {rows.length === 0
                        ? "Importe a base ou adicione um cliente na mão."
                        : "Ninguém nesta faixa agora. O público é um filtro, não uma lista congelada."}
                    </td>
                  </tr>
                ) : (
                  visible.map((customer) => {
                    const days = daysSince(customer.lastPurchaseAt);
                    const active = customer.id === selectedId;
                    return (
                      <tr
                        key={customer.id}
                        className={`cursor-pointer ${active ? "bg-emerald-50" : "hover:bg-[#F5F6F6]"}`}
                        onClick={() => openEdit(customer)}
                      >
                        <td className="px-4 py-2.5 font-medium tracking-tight text-[#111B21]">
                          <span className="inline-flex items-center gap-2">
                            <HeatDot days={days} />
                            {customer.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#667781]">
                          {formatWhatsAppPhone(customer.phone) ?? customer.phone}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[#111B21]">
                          {days === Number.POSITIVE_INFINITY ? "—" : `${days} dias`}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[#111B21]">
                          {customer.orderCount > 0 ? customer.orderCount : "—"}
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
                  A bolinha ao lado do nome sai da última visita. Não pinte etiqueta no lugar da data.
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
                Bolinha: verde Ativos, amarela Em risco, laranja Inativos, vermelha Perdidos.
                Branca = ainda sem segmento (faltou os dias na planilha).
                {selected ? ` ID: ${selected.id}` : null}
              </span>
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Quantidade de pedidos</span>
              <input
                type="number"
                min={0}
                max={100000}
                value={draft.orderCount}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, orderCount: event.target.value }))
                }
                className={inputClass}
              />
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

function ListFreshnessBar({ freshness }: { freshness: ListFreshness }) {
  const box = {
    empty: "border-[#E9EDEF] bg-[#F8F9FA] text-[#667781]",
    ok: "border-emerald-100 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    stale: "border-red-200 bg-red-50 text-red-900",
    never: "border-amber-200 bg-amber-50 text-amber-950",
  }[freshness.tone];
  const dot = {
    empty: "idle",
    ok: "live",
    warn: "pending",
    stale: "offline",
    never: "pending",
  }[freshness.tone] as "idle" | "live" | "pending" | "offline";

  return (
    <div className={`flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border px-3 py-2 ${box}`}>
      <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
        <StatusDot tone={dot} />
        {freshness.title}
      </p>
      <p className="text-xs opacity-90">{freshness.detail}</p>
    </div>
  );
}

function HeatDot({ days }: { days: number }) {
  const segment = segmentForDays(days);
  if (!segment) {
    return (
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full border border-[#CED4DA] bg-white"
        title="Sem segmento"
        aria-label="Sem segmento"
      />
    );
  }
  const tone = {
    ativos: "bg-emerald-500",
    em_risco: "bg-amber-400",
    inativos: "bg-orange-500",
    perdidos: "bg-red-500",
  }[segment];
  const label = RECENCY_SEGMENTS[segment].label;
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone}`}
      title={label}
      aria-label={label}
    />
  );
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th
      className="px-4 py-2"
      aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-[#111B21] ${
          active ? "font-semibold text-[#111B21]" : "font-medium text-[#667781]"
        }`}
      >
        {label}
        <span className="font-semibold tracking-normal" aria-hidden>
          {active ? (direction === "desc" ? "↓" : "↑") : ""}
        </span>
      </button>
    </th>
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
