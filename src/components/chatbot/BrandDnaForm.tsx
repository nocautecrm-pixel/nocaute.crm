"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  btnPrimaryClass,
  cardClass,
  eyebrowClass,
  inputClass,
  labelClass,
  labelTextClass,
} from "@/components/ui/tokens";
import type { BrandDna, ChatbotDetailLevel, ChatbotTone } from "@/lib/chatbot/dna";

const TONES: Array<{ id: ChatbotTone; label: string }> = [
  { id: "descontraido", label: "Leve" },
  { id: "objetivo", label: "Direto" },
  { id: "premium", label: "Premium" },
  { id: "formal", label: "Formal" },
];

const DETAILS: Array<{ id: ChatbotDetailLevel; label: string }> = [
  { id: "curto", label: "Curto" },
  { id: "medio", label: "Médio" },
  { id: "completo", label: "Completo" },
];

function ChipGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`h-8 rounded-lg px-3 text-xs font-semibold tracking-tight transition-all duration-200 ${
              active
                ? "bg-slate-900 text-white"
                : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function BrandDnaForm({
  dna,
  onChange,
  highlight,
}: {
  dna: BrandDna;
  onChange: (dna: BrandDna) => void;
  highlight?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function patch<K extends keyof BrandDna>(key: K, value: BrandDna[K]) {
    onChange({ ...dna, [key]: value });
    setStatus(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/chatbot/dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dna),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Falha ao salvar");
      setStatus("DNA atualizado. A API não precisa reconectar.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="dna-marca"
      className={`${cardClass} p-5 ${highlight ? "ring-1 ring-emerald-500/20" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`${eyebrowClass} text-emerald-700`}>Chatbot</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
            DNA da marca
          </h2>
        </div>
        <InfoTooltip text="Essas regras entram no motor de mensagens da Cloud API. Você pode ajustar sem reconectar o WhatsApp." />
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <label className={labelClass}>
          <span className={`${labelTextClass} flex items-center gap-1`}>
            Personalidade
            <InfoTooltip text="Quem o bot é. Ex.: atendente da saladeria, fresco e direto." />
          </span>
          <input
            value={dna.personality}
            onChange={(event) => patch("personality", event.target.value)}
            className={inputClass}
            placeholder="Atendente da casa, leve e direto"
            maxLength={280}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Saudação</span>
          <input
            value={dna.greeting}
            onChange={(event) => patch("greeting", event.target.value)}
            className={inputClass}
            placeholder="Oi! Aqui é da casa"
            maxLength={80}
          />
        </label>

        <div className="space-y-1.5">
          <p className={`${labelTextClass} text-sm`}>Tom de voz</p>
          <ChipGroup value={dna.tone} options={TONES} onChange={(value) => patch("tone", value)} />
        </div>

        <div className="space-y-1.5">
          <p className={`${labelTextClass} flex items-center gap-1 text-sm`}>
            Detalhamento
            <InfoTooltip text="Curto cabe melhor no WhatsApp. Completo explica cardápio e cupom." />
          </p>
          <ChipGroup
            value={dna.detailLevel}
            options={DETAILS}
            onChange={(value) => patch("detailLevel", value)}
          />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2.5">
          <span className="text-sm font-medium text-slate-700">Emojis</span>
          <input
            type="checkbox"
            checked={dna.emojis}
            onChange={(event) => patch("emojis", event.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
        </label>

        <button type="submit" disabled={saving} className={btnPrimaryClass}>
          {saving ? "Salvando…" : "Salvar DNA"}
        </button>
        {status ? <p className="text-xs text-slate-500">{status}</p> : null}
      </form>
    </section>
  );
}
