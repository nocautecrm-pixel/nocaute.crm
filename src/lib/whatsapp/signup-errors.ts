/** Mensagens Meta Embedded Signup → texto claro para o lojista. */

export const META_APP_REVIEW_REQUIRED =
  "A Meta ainda está liberando a conexão automática para lojas. Em breve você consegue ligar o WhatsApp por aqui. Se precisar agora, fale com o suporte Nocaute.";

export function humanizeMetaSignupError(
  raw: string | null | undefined,
  opts?: { path?: "existing" | "new" },
): string {
  if (!raw?.trim()) return "Não foi possível abrir a Meta. Tente de novo.";
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
    lower.includes("app review") ||
    lower.includes("advanced access")
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
      "A Meta pediu um código em vez de ligar o WhatsApp do celular. Feche, escolha de novo “Já uso no celular” e no popup ligue com QR — é o mesmo número da loja."
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
        "Parece que a Meta pediu SMS em vez do QR. Feche a janela, abra de novo e escolha ligar o WhatsApp do celular — sem número novo e sem chip extra."
      );
    }
    if (opts?.path === "new") {
      return (
        "Não deu para confirmar esse número. Se a loja já usa WhatsApp no celular, volte e use “Já uso no celular”."
      );
    }
    return (
      "A Meta pediu um código de verificação. Se a loja já usa WhatsApp no celular, use “Já uso no celular” (QR)."
    );
  }

  return text;
}

export function isMetaAppReviewError(message: string | null | undefined) {
  if (!message) return false;
  return (
    message === META_APP_REVIEW_REQUIRED ||
    message.includes("2655111") ||
    message.toLowerCase().includes("liberando a conexão") ||
    message.toLowerCase().includes("app review no app parceiro")
  );
}

/** Erro típico de ter caído no fluxo SMS/Cloud em vez do QR. */
export function isWrongOnboardingPathError(message: string | null | undefined) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("pediu sms") ||
    lower.includes("em vez do qr") ||
    lower.includes("em vez de ligar") ||
    lower.includes("caminho errado") ||
    lower.includes("por verificar")
  );
}
