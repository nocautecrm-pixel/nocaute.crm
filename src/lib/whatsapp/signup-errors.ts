/** Mensagens Meta Embedded Signup → texto claro para o lojista. */

export const META_APP_REVIEW_REQUIRED =
  "Falta App Review no app parceiro (Nocaute CRM). A Meta bloqueou a integração: o app ainda não tem Advanced Access de whatsapp_business_messaging e whatsapp_business_management. No developers.facebook.com → App Review, pede essas permissões. Sem isso o QR/coexistência não abre para lojas.";

export function humanizeMetaSignupError(
  raw: string | null | undefined,
  opts?: { path?: "existing" | "new" },
): string {
  if (!raw?.trim()) return "Erro no login da Meta.";
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (
    text.includes("2655111") ||
    lower.includes("app do parceiro não tem as permissões") ||
    lower.includes("partner app does not have") ||
    lower.includes("permissões de mensagens") ||
    lower.includes("gerenciamento do whatsapp business avançadas") ||
    lower.includes("advanced messaging") ||
    lower.includes("através do processo de análise do app") ||
    lower.includes("app review")
  ) {
    return META_APP_REVIEW_REQUIRED;
  }

  if (
    lower.includes("por verificar") ||
    lower.includes("code_verification_status") ||
    lower.includes("não está verificado na meta") ||
    lower.includes("nao esta verificado na meta") ||
    (lower.includes("unverified") && lower.includes("phone"))
  ) {
    return (
      "A Meta gravou um número Cloud “por verificar” (SMS), não o WhatsApp Business do celular. " +
      "Isso não é o caminho da loja: na Meta Business apague esse número da WABA e no Nocaute " +
      "reconecte com “Já uso o WhatsApp Business no celular” (QR). Não precisa comprar outro chip — " +
      "use o mesmo número do app."
    );
  }

  if (
    lower.includes("sms") ||
    lower.includes("código de verifica") ||
    lower.includes("codigo de verifica") ||
    lower.includes("verification code") ||
    lower.includes("já regist") ||
    lower.includes("ja regist") ||
    lower.includes("already registered") ||
    lower.includes("enviar código") ||
    lower.includes("enviar codigo") ||
    (lower.includes("número") && lower.includes("problema")) ||
    (lower.includes("numero") && lower.includes("problema"))
  ) {
    if (opts?.path === "existing") {
      return (
        "Você escolheu “já uso no celular”, mas a Meta pediu SMS / número com problema. " +
        "Caminho errado: no popup escolha ligar o WhatsApp Business do celular (QR), " +
        "não “adicionar número novo”. Não precisa criar nem comprar outro número — " +
        "é o mesmo do app. Se um Cloud ficou preso na WABA, apague-o e tente de novo."
      );
    }
    if (opts?.path === "new") {
      return (
        "A Meta não verificou este número por SMS. Neste caminho o número tem de estar livre " +
        "(não pode estar no WhatsApp pessoal/Business). Se a loja já atende no celular, " +
        "volte e use “Já uso o WhatsApp Business no celular” (QR) — mesmo número, sem chip novo."
      );
    }
    return (
      "A Meta pediu SMS / número por verificar. Se a loja já usa WhatsApp Business no celular, " +
      "escolha “Já uso…” (QR): mesmo número, sem comprar chip. Só use número novo/SMS se o " +
      "número ainda não estiver em nenhum WhatsApp."
    );
  }

  return text;
}

export function isMetaAppReviewError(message: string | null | undefined) {
  if (!message) return false;
  return (
    message === META_APP_REVIEW_REQUIRED ||
    message.includes("2655111") ||
    message.toLowerCase().includes("app review no app parceiro")
  );
}

/** Erro típico de ter caído no fluxo SMS/Cloud em vez do QR. */
export function isWrongOnboardingPathError(message: string | null | undefined) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("caminho errado") ||
    lower.includes("por verificar") ||
    lower.includes("não precisa criar nem comprar") ||
    lower.includes("nao precisa criar nem comprar") ||
    (lower.includes("já uso") && lower.includes("sms"))
  );
}
