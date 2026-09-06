/** Mensagens Meta Embedded Signup → texto claro para o lojista. */

export const META_APP_REVIEW_REQUIRED =
  "Falta App Review no app parceiro (Nocaute CRM). A Meta bloqueou a integração: o app ainda não tem Advanced Access de whatsapp_business_messaging e whatsapp_business_management. No developers.facebook.com → App Review, pede essas permissões. Sem isso o QR/coexistência não abre para lojas.";

export function humanizeMetaSignupError(raw: string | null | undefined): string {
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
    lower.includes("enviar código")
  ) {
    return (
      "A Meta pediu SMS / número por verificar — esse telefone Cloud está inválido para coexistência. " +
      "Apaga-o na WABA e liga pelo app (QR). Se vires erro #2655111, o bloqueio é App Review do app parceiro."
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
