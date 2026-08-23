"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { RECENCY_SEGMENTS } from "@/lib/segments/recency";
import {
  DEFAULT_CTA_LABEL,
  DEFAULT_MEDIA_CAPTION,
  DEFAULT_OFFER_BODY,
  RETURN_TEMPLATE,
} from "@/lib/whatsapp/constants";
import { interpolateOfferText } from "@/lib/whatsapp/payloads";
import {
  btnPrimaryClass,
  cardClass,
  eyebrowClass,
  inputClass,
  labelClass,
  labelTextClass,
} from "@/components/ui/tokens";
import type { RecencySegment } from "@/types/database";

export function CampaignWizard({
  storeName,
  menuUrl,
}: {
  storeName: string;
  menuUrl: string;
}) {
  const router = useRouter();
  const [segment, setSegment] = useState<RecencySegment>("inativos");
  const [name, setName] = useState<string>(`${storeName} — retorno`);
  const [establishmentName, setEstablishmentName] = useState<string>(storeName);
  const [promoCode, setPromoCode] = useState<string>(BRAND.promoCode);
  const [discountLabel, setDiscountLabel] = useState<string>(BRAND.discountLabel);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaFileName, setMediaFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [offerBody, setOfferBody] = useState<string>(DEFAULT_OFFER_BODY);
  const [ctaUrl, setCtaUrl] = useState<string>(menuUrl || BRAND.ctaUrl);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [startsAt, setStartsAt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          segment,
          templateName: RETURN_TEMPLATE.name,
          templateLanguage: RETURN_TEMPLATE.language,
          establishmentName,
          promoCode,
          discountLabel,
          offerBody,
          mediaType: mediaUrl ? mediaType : undefined,
          mediaUrl: mediaUrl || undefined,
          mediaCaption: DEFAULT_MEDIA_CAPTION,
          ctaUrl,
          ctaLabel: DEFAULT_CTA_LABEL,
          startsAt: when === "later" && startsAt ? new Date(startsAt).toISOString() : undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        recipients?: number;
        message?: string;
        demo?: boolean;
      };
      if (!response.ok) throw new Error(payload.error ?? "Falha ao criar campanha");
      router.push("/resultados");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onCreativeFile(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    setMediaFileName(file.name);
    setMediaPreview(URL.createObjectURL(file));
    if (file.type.startsWith("video/")) setMediaType("video");
    else setMediaType("image");

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/campaigns/media", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        error?: string;
        url?: string;
        mediaType?: "image" | "video";
      };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Não foi possível enviar o criativo");
      }
      setMediaUrl(payload.url);
      if (payload.mediaType) setMediaType(payload.mediaType);
    } catch (error) {
      setMediaUrl("");
      setStatus(error instanceof Error ? error.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid h-full min-h-0 gap-3 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
      <section className={`${cardClass} flex min-h-0 flex-col overflow-y-auto p-4`}>
        <h2 className="text-base font-semibold tracking-tight text-slate-900">Nova campanha</h2>
        <p className="mt-1 text-sm text-slate-500">
          O template aprovado é {RETURN_TEMPLATE.name} (botão “Ver Cardápio”). O cupom único é
          gerado agora, na criação da fila, e segue na oferta. Não inventamos um segundo
          “Confirmar” neste disparo.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={labelTextClass}>Nome interno</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Nome da casa</span>
            <input
              value={establishmentName}
              onChange={(event) => setEstablishmentName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>Quem vai receber</span>
            <select
              value={segment}
              onChange={(event) => setSegment(event.target.value as RecencySegment)}
              className={inputClass}
            >
              {(Object.keys(RECENCY_SEGMENTS) as RecencySegment[]).map((key) => (
                <option key={key} value={key}>
                  {RECENCY_SEGMENTS[key].label} — {RECENCY_SEGMENTS[key].hint}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Cupom</span>
            <input
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Desconto</span>
            <input
              value={discountLabel}
              onChange={(event) => setDiscountLabel(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>Quando disparar</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setWhen("now")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  when === "now"
                    ? "bg-[#111B21] font-semibold text-white"
                    : "border border-[#E9EDEF] bg-white text-[#667781]"
                }`}
              >
                Enviar agora
              </button>
              <button
                type="button"
                onClick={() => setWhen("later")}
                className={`rounded-lg px-3 py-2 text-sm ${
                  when === "later"
                    ? "bg-[#111B21] font-semibold text-white"
                    : "border border-[#E9EDEF] bg-white text-[#667781]"
                }`}
              >
                Agendar
              </button>
              {when === "later" ? (
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  required
                  className={`${inputClass} max-w-[220px]`}
                />
              ) : null}
            </div>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>Link do cardápio / resgate</span>
            <input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <div className={`${cardClass} space-y-2 p-4`}>
          <p className={eyebrowClass}>WhatsApp — template aprovado</p>
          <p className="text-sm leading-relaxed text-slate-500">
            {RETURN_TEMPLATE.body.replace("{{1}}", "Maria")}
          </p>
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            Botão: {RETURN_TEMPLATE.button}
          </span>
          <p className="text-xs text-slate-400">
            Template <span className="font-mono">{RETURN_TEMPLATE.name}</span> — a Meta tem que
            estar APPROVED nesta WABA. A ferramenta recusa o disparo se não estiver. Só entram
            clientes com opt-in comprovado (origem + comprovante na planilha).
          </p>
        </div>

        <div className={`${cardClass} grid min-h-0 flex-1 gap-3 p-4 lg:grid-cols-2`}>
          <div className="space-y-3">
            <p className={eyebrowClass}>Criativo opcional (janela 24h)</p>
            <label className={labelClass}>
              <span className={labelTextClass}>Tipo do criativo</span>
              <select
                value={mediaType}
                onChange={(event) => setMediaType(event.target.value as "image" | "video")}
                className={inputClass}
              >
                <option value="image">Imagem</option>
                <option value="video">Vídeo</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm">
              <span className={labelTextClass}>Criativo (upload do PC)</span>
              <span className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-3 font-medium text-emerald-700 hover:bg-emerald-50">
                {uploading ? "Enviando…" : mediaFileName ? "Trocar arquivo" : "Fazer upload"}
              </span>
              <input
                type="file"
                accept={mediaType === "video" ? "video/mp4" : "image/jpeg,image/png,image/webp"}
                className="hidden"
                onChange={(event) => {
                  void onCreativeFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white">
              {mediaPreview ? (
                mediaType === "video" ? (
                  <video src={mediaPreview} controls className="max-h-28 w-full object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaPreview} alt="Criativo" className="max-h-28 w-full object-contain" />
                )
              ) : (
                <div className="flex h-20 items-center justify-center px-3 text-center text-xs text-slate-400">
                  Foto ou vídeo da oferta.
                </div>
              )}
              <p className="truncate px-3 py-1.5 text-xs text-slate-400">
                {mediaFileName || "JPG, PNG, WEBP até 5 MB ou MP4 até 16 MB."}
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Descrição da oferta</span>
              <textarea
                value={offerBody}
                onChange={(event) => setOfferBody(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              />
            </label>
            <div className="rounded-lg border border-emerald-200/70 bg-white px-3 py-2 text-sm">
              <p className={eyebrowClass}>Como o cliente vê</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap leading-relaxed text-slate-700">
                {interpolateOfferText(offerBody, {
                  loja: establishmentName,
                  cupom: promoCode,
                  desconto: discountLabel,
                })}
              </p>
              <span className="mt-2 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                {DEFAULT_CTA_LABEL}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button type="submit" disabled={loading || uploading} className={btnPrimaryClass}>
            {loading ? "Preparando…" : when === "later" ? "Agendar campanha" : "Enfileirar campanha"}
          </button>
          {status ? <p className="text-sm text-slate-500">{status}</p> : null}
        </div>
      </section>
    </form>
  );
}
