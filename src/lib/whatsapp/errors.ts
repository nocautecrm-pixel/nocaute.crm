export type WhatsAppErrorAction = "retry" | "skip" | "pause";

export function classifyWhatsAppError(code?: number): WhatsAppErrorAction {
  if (code === 130429) return "retry";
  if (code === 131026 || code === 131047) return "skip";
  if (code === 131048 || code === 131056) return "pause";
  return "retry";
}
