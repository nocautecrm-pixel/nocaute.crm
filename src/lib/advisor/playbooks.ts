import { DEFAULT_AUDIENCES, LEGACY_HEAT_AUDIENCE_SLUGS } from "@/lib/audiences/defaults";
import { buildCampaignDraft } from "@/lib/advisor/copy";
import type { Advice, AdvisorSnapshot } from "@/lib/advisor/types";
import { RECENCY_SEGMENTS } from "@/lib/segments/recency";
import type { RecencySegment } from "@/types/database";

const RECENT_MS = 7 * 86_400_000;
const AUDIENCE_ORDER = ["inativos", "em_risco", "perdidos", "ativos"] as const;

function qualityTone(raw: string | null) {
  const value = (raw ?? "").toUpperCase();
  if (value === "RED") return "red" as const;
  if (value === "YELLOW") return "yellow" as const;
  return "ok" as const;
}

function recentlyTargeted(snapshot: AdvisorSnapshot, slug: string) {
  const at = snapshot.recentAudienceAt[slug];
  if (!at) return false;
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return false;
  return snapshot.now.getTime() - then < RECENT_MS;
}

function weekday(snapshot: AdvisorSnapshot) {
  return snapshot.now.getDay();
}

function audienceHint(slug: string) {
  if (slug in RECENCY_SEGMENTS) {
    return RECENCY_SEGMENTS[slug as RecencySegment].hint;
  }
  const def = DEFAULT_AUDIENCES.find((item) => item.slug === slug);
  if (def) return `${def.minDays} a ${def.maxDays} dias sem vir`;
  return "Faixa de recência da casa";
}

function campaignAdvice(
  snapshot: AdvisorSnapshot,
  slug: string,
  priority: 1 | 2 | 3,
  extraWhy?: string,
): Advice {
  const count = snapshot.byAudience[slug] ?? 0;
  const label = snapshot.audienceLabels[slug] ?? slug;
  const draft = buildCampaignDraft({
    storeName: snapshot.storeName,
    menuUrl: snapshot.menuUrl,
    audienceSlug: slug,
    audienceName: label,
  });
  const quotaNote =
    snapshot.quotaRemaining < count
      ? ` Restam ${snapshot.quotaRemaining} leads no plano; a fila para no limite.`
      : "";
  const conversionNote =
    snapshot.conversionRate > 0
      ? ` Os cupons da casa convertem ${snapshot.conversionRate}%.`
      : "";

  return {
    id: `campaign-${slug}`,
    kind: "campaign",
    title: `${label}: ${count} cliente${count === 1 ? "" : "s"}`,
    why:
      extraWhy ??
      `${audienceHint(slug)}. Oferta sugerida: ${draft.discountLabel}.${conversionNote}${quotaNote}`,
    priority,
    ctaLabel: "Usar esta campanha",
    action: { type: "prefill_campaign", draft },
  };
}

export function rankAdvice(snapshot: AdvisorSnapshot): Advice[] {
  const items: Advice[] = [];
  const quality = qualityTone(snapshot.qualityRating);

  if (!snapshot.whatsappConnected) {
    items.push({
      id: "setup-whatsapp",
      kind: "ops",
      title: "Conecte o WhatsApp da casa",
      why: "Sem o número oficial da Meta, a campanha não sai. O cérebro só sugere disparo com a API no ar.",
      priority: 1,
      ctaLabel: "Ir para Conectar",
      action: { type: "navigate", href: "/configuracoes" },
    });
  }

  if (!snapshot.menuUrl.trim()) {
    items.push({
      id: "setup-menu",
      kind: "ops",
      title: "Falta o link do cardápio",
      why: "O botão da oferta aponta para o cardápio. Cadastre o link no perfil da loja antes de disparar.",
      priority: 1,
      ctaLabel: "Preencher perfil",
      action: { type: "navigate", href: "/configuracoes" },
    });
  }

  if (snapshot.optedInTotal === 0) {
    items.push({
      id: "setup-optin",
      kind: "ops",
      title:
        snapshot.totalCustomers === 0
          ? "Cadastre clientes com opt-in"
          : "Ninguém na base tem opt-in comprovado",
      why: "Campanha só entra na fila para quem tem origem e comprovante de opt-in. Importe ou registre no caixa.",
      priority: 1,
      ctaLabel: "Abrir base de clientes",
      action: { type: "navigate", href: "/clientes" },
    });
  }

  if (quality === "red") {
    items.push({
      id: "hold-quality",
      kind: "hold",
      title: "Número com qualidade vermelha",
      why: "A Meta restringe disparo de marketing. Espere a qualidade subir antes de uma campanha nova.",
      priority: 1,
      ctaLabel: "Ver conexão",
      action: { type: "navigate", href: "/configuracoes" },
    });
  } else if (quality === "yellow") {
    items.push({
      id: "hold-quality",
      kind: "hold",
      title: "Qualidade do número em amarelo",
      why: "Prefira um lote menor. Volume alto agora pode derrubar o número.",
      priority: 2,
      ctaLabel: "Ver conexão",
      action: { type: "navigate", href: "/configuracoes" },
    });
  }

  if (snapshot.quotaRemaining <= 0) {
    items.push({
      id: "hold-quota",
      kind: "hold",
      title: "Franquia do mês esgotada",
      why: `O plano inclui ${snapshot.quotaIncluded} leads. Sem saldo, a campanha não entra na fila.`,
      priority: 1,
      ctaLabel: "Ver plano",
      action: { type: "navigate", href: "/plano" },
    });
  }

  if (snapshot.inFlightCount > 0) {
    items.push({
      id: "hold-inflight",
      kind: "hold",
      title:
        snapshot.inFlightCount === 1
          ? "Já tem uma campanha na fila"
          : `${snapshot.inFlightCount} campanhas em andamento`,
      why: snapshot.lastCampaignName
        ? `“${snapshot.lastCampaignName}” ainda não terminou. Você pode preparar a próxima, mas espere este lote sair.`
        : "Espere o lote atual entregar antes de um disparo grande.",
      priority: 2,
      ctaLabel: "Ver relatórios",
      action: { type: "navigate", href: "/resultados" },
    });
  }

  const blocked =
    !snapshot.whatsappConnected ||
    snapshot.optedInTotal === 0 ||
    snapshot.quotaRemaining <= 0 ||
    quality === "red";

  if (!blocked) {
    const day = weekday(snapshot);
    const weekendMenu = day === 5 || day === 6;
    const picks: string[] = [];

    for (const slug of AUDIENCE_ORDER) {
      const count = snapshot.byAudience[slug] ?? 0;
      if (count <= 0) continue;
      if (recentlyTargeted(snapshot, slug)) continue;
      if (slug === "ativos" && !weekendMenu && picks.length > 0) continue;
      picks.push(slug);
    }

    const campaignPriority: 1 | 2 | 3 = items.some((item) => item.priority === 1) ? 2 : 1;
    for (const [index, slug] of picks.slice(0, 2).entries()) {
      const priority = (index === 0 ? campaignPriority : 3) as 1 | 2 | 3;
      items.push(campaignAdvice(snapshot, slug, priority));
    }
  }

  if (items.length === 0) {
    items.push({
      id: "idle-ok",
      kind: "ops",
      title: "Nada urgente agora",
      why: "WhatsApp no ar, opt-in em dia e nenhum grupo grande parado. Volte quando a recência mudar ou após o próximo cupom no caixa.",
      priority: 3,
      ctaLabel: "Ver clientes",
      action: { type: "navigate", href: "/clientes" },
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

export function adviceById(snapshot: AdvisorSnapshot, id: string): Advice | null {
  const ranked = rankAdvice(snapshot);
  const found = ranked.find((item) => item.id === id);
  if (found) return found;

  const raw = id.startsWith("campaign-") ? id.slice("campaign-".length) : null;
  if (!raw) return null;
  const slug = LEGACY_HEAT_AUDIENCE_SLUGS[raw] ?? raw;
  if (snapshot.byAudience[slug] === undefined && !DEFAULT_AUDIENCES.some((item) => item.slug === slug)) {
    return null;
  }
  return campaignAdvice(snapshot, slug, 2);
}
