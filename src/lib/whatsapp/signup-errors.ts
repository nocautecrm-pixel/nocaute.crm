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
    lower.includes("sms") ||
    lower.includes("código de verifica") ||
    lower.includes("codigo de verifica") ||
    lower.includes("verification code") ||
    lower.includes("já regist") ||
    lower.includes("ja regist") ||
    lower.includes("already registered") ||
    lower.includes("enviar código") ||
    (lower.includes("número") && lower.includes("problema")) ||
    (lower.includes("numero") && lower.includes("problema"))
  ) {
    if (opts?.path === "existing") {
      return (
        "Você escolheu “já uso o WhatsApp”, mas a Meta pediu SMS / disse que o número tem problema. " +
        "Isso é o caminho errado: no popup escolha ligar o WhatsApp Business do celular (QR), " +
        "não “adicionar número novo”. Se um número Cloud ficou preso na WABA, apague-o e tente de novo."
      );
    }
    if (opts?.path === "new") {
      return (
        "A Meta não conseguiu verificar este número por SMS. Confira se o número está livre " +
        "(não pode estar no WhatsApp pessoal/Business ao mesmo tempo neste caminho). " +
        "Se o número já está no WhatsApp Business do celular, volte e use “Já uso o WhatsApp da Meta”."
      );
    }
    return (
      "A Meta pediu SMS / número por verificar. Se a loja já usa WhatsApp Business no celular, " +
      "volte e escolha “Já uso o WhatsApp da Meta” (QR). Se for número novo, confira se não está em outro app."
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
