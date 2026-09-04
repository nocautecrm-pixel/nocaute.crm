const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Janela de atendimento Meta (24h após última msg do cliente). Usada só para status da conexão. */
export function customerCareWindow(lastInboundAt: string | null) {
  if (!lastInboundAt) {
    return { open: false, hoursLeft: null as number | null };
  }

  const remaining = WINDOW_MS - (Date.now() - new Date(lastInboundAt).getTime());
  if (remaining <= 0) {
    return { open: false, hoursLeft: 0 };
  }

  return {
    open: true,
    hoursLeft: Math.max(1, Math.ceil(remaining / (60 * 60 * 1000))),
  };
}
