/** Como o lojista entra no Embedded Signup da Meta. */
export type WhatsAppOnboardingMode = "existing" | "new";

export function isWhatsAppOnboardingMode(value: unknown): value is WhatsAppOnboardingMode {
  return value === "existing" || value === "new";
}
