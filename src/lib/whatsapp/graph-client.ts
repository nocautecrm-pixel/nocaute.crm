import { getGraphVersion } from "@/lib/config";

type GraphError = {
  error?: { code?: number; message?: string };
};

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

function graphUrl(path: string) {
  return `https://graph.facebook.com/${getGraphVersion()}${path}`;
}

export async function postWhatsAppMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  payload: Record<string, unknown>;
}) {
  const response = await fetch(graphUrl(`/${input.phoneNumberId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.payload),
    signal: AbortSignal.timeout(20_000),
  });

  const body = (await response.json()) as GraphError & {
    messages?: Array<{ id: string }>;
  };

  if (!response.ok) {
    throw new MetaGraphError(
      body.error?.message ?? "Falha ao enviar mensagem na Cloud API",
      body.error?.code,
    );
  }

  const wamid = body.messages?.[0]?.id;
  if (!wamid) throw new Error("Resposta de envio sem identificação; conciliação necessária.");
  return wamid;
}
