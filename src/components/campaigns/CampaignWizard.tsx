"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BRAND } from "@/lib/brand";
import type { CampaignDraft } from "@/lib/advisor/types";
import { audienceRangeLabel } from "@/lib/audiences/defaults";
import type { AudienceWithCount } from "@/lib/audiences/types";
import {
  DEFAULT_CTA_LABEL,
  DEFAULT_MEDIA_CAPTION,
  DEFAULT_OFFER_BODY,
  OPTIN_TEMPLATE,
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

export function CampaignWizard({
  storeName,
  menuUrl,
  audiences,
  draft,
  adviceWhy,
}: {
  storeName: string;
  menuUrl: string;
  audiences: AudienceWithCount[];
  draft?: CampaignDraft | null;
  adviceWhy?: string | null;
}) {
  const router = useRouter();
  const initialAudienceId = useMemo(() => {
    const fromDraft = audiences.find(
      (audience) => audience.slug === draft?.audienceSlug || audience.id === draft?.audienceSlug,
    );
    if (fromDraft) return fromDraft.id;
    return audiences.find((audience) => audience.optedIn > 0)?.id ?? audiences[0]?.id ?? "";
  }, [audiences, draft?.audienceSlug]);
  const [audienceId, setAudienceId] = useState(initialAudienceId);
  const selectedAudience = audiences.find((audience) => audience.id === audienceId) ?? audiences[0];
  const [name, setName] = useState<string>(draft?.name ?? `${storeName} — retorno`);
  const [establishmentName, setEstablishmentName] = useState<string>(
    draft?.establishmentName ?? storeName,
  );
  const [promoCode, setPromoCode] = useState<string>(draft?.promoCode ?? BRAND.promoCode);
  const [discountLabel, setDiscountLabel] = useState<string>(
    draft?.discountLabel ?? BRAND.discountLabel,
  );
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaFileName, setMediaFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [offerBody, setOfferBody] = useState<string>(draft?.offerBody ?? DEFAULT_OFFER_BODY);
  const [ctaUrl, setCtaUrl] = useState<string>(draft?.ctaUrl || menuUrl || BRAND.ctaUrl);
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
          audienceId,
          templateName: OPTIN_TEMPLATE.name,
          templateLanguage: OPTIN_TEMPLATE.language,
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
        {adviceWhy ? (
          <p className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Nocaute preencheu isto porque: {adviceWhy} Você pode editar antes de enfileirar.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            Msg 1 usa o template {OPTIN_TEMPLATE.name}: botões Continuar e Não receber oferta. Só
            quem toca Continuar recebe criativo, texto, link do cardápio e cupom. A ferramenta não
            segue conversa depois disso.
          </p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className={`${labelClass} sm:col-span-3`}>
            <span className={labelTextClass}>Público</span>
            <select
              value={audienceId}
              onChange={(event) => setAudienceId(event.target.value)}
              className={inputClass}
              required
            >
              {audiences.map((audience) => (
                <option key={audience.id} value={audience.id}>
                  {audience.name} — {audience.optedIn} com opt-in ({audienceRangeLabel(audience.minDays, audience.maxDays)})
                </option>
              ))}
            </select>
            <span className="text-xs text-[#667781]">
              {selectedAudience
                ? `A fila lê a faixa na hora do envio: opt-in + ${audienceRangeLabel(selectedAudience.minDays, selectedAudience.maxDays)} + limite Meta. Crie públicos em Base de Clientes.`
                : "Crie um público em Base de Clientes antes de disparar."}
            </span>
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Nome interno</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
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
          <label className={`${labelClass} sm:col-span-3`}>
            <span className={labelTextClass}>Nome da casa</span>
            <input
              value={establishmentName}
              onChange={(event) => setEstablishmentName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-3`}>
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
          <label className={`${labelClass} sm:col-span-3`}>
            <span className={labelTextClass}>Link do cardápio / resgate</span>
            <input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <div className={`${cardClass} space-y-2 p-4`}>
          <p className={eyebrowClass}>WhatsApp — msg 1 (template)</p>
          <p className="text-sm leading-relaxed text-slate-500">
            {OPTIN_TEMPLATE.body.replace("{{1}}", establishmentName || "sua loja")}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              {OPTIN_TEMPLATE.buttons[0]}
            </span>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              {OPTIN_TEMPLATE.buttons[1]}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Template <span className="font-mono">{OPTIN_TEMPLATE.name}</span> — precisa estar
            APPROVED na WABA. Continuar dispara a oferta; Não receber oferta encerra sem mais
            mensagem desta ferramenta.
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
