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

export async function getWhatsAppGraphJson<T>(input: {
  path: string;
  accessToken: string;
  timeoutMs?: number;
}): Promise<T> {
  const response = await fetch(graphUrl(input.path), {
    method: "GET",
    headers: { Authorization: `Bearer ${input.accessToken}` },
    signal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
  });

  const body = (await response.json()) as T & GraphError;
  if (!response.ok || body.error) {
    throw new MetaGraphError(
      body.error?.message ?? "Falha na Graph API",
      body.error?.code,
    );
  }
  return body;
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
