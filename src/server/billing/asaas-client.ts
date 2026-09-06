import {
  getAsaasApiKey,
  getAsaasBaseUrl,
  isAsaasConfigured,
  type AsaasBillingType,
} from "@/lib/billing/asaas-config";

export class AsaasNotConfiguredError extends Error {
  readonly code = "billing_not_configured" as const;

  constructor() {
    super(
      "Asaas ainda não está configurado. Preencha ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN no .env.local.",
    );
    this.name = "AsaasNotConfiguredError";
  }
}

export class AsaasApiError extends Error {
  readonly code = "asaas_api_error" as const;

  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "AsaasApiError";
  }
}

type AsaasRequestInit = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

async function asaasFetch<T>(path: string, init: AsaasRequestInit = {}): Promise<T> {
  if (!isAsaasConfigured()) {
    throw new AsaasNotConfiguredError();
  }

  const url = `${getAsaasBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "NocauteCRM/0.1 (Next.js)",
      access_token: getAsaasApiKey(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof json === "object" &&
      json &&
      "errors" in json &&
      Array.isArray((json as { errors: { description?: string }[] }).errors)
        ? (json as { errors: { description?: string }[] }).errors
            .map((e) => e.description)
            .filter(Boolean)
            .join("; ") || `Asaas HTTP ${response.status}`
        : `Asaas HTTP ${response.status}`;
    throw new AsaasApiError(message, response.status, json);
  }

  return json as T;
}

export type AsaasCustomer = {
  id: string;
  name: string;
  email?: string | null;
  cpfCnpj?: string | null;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  cycle: string;
  status: string;
  nextDueDate: string;
  externalReference?: string | null;
  invoiceUrl?: string | null;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string | null;
  billingType: string;
  value: number;
  status: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  externalReference?: string | null;
};

export async function findAsaasCustomerByExternalReference(externalReference: string) {
  const data = await asaasFetch<{ data?: AsaasCustomer[] }>(
    `/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
  );
  return data.data?.[0] ?? null;
}

export async function createAsaasCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  externalReference: string;
}) {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
      externalReference: input.externalReference,
      notificationDisabled: false,
    },
  });
}

export async function createAsaasSubscription(input: {
  customerId: string;
  billingType: AsaasBillingType;
  value: number;
  description: string;
  externalReference: string;
  nextDueDate: string;
}) {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: {
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: "MONTHLY",
      description: input.description,
      externalReference: input.externalReference,
    },
  });
}

export async function listSubscriptionPayments(subscriptionId: string) {
  const data = await asaasFetch<{ data?: AsaasPayment[] }>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=1`,
  );
  return data.data ?? [];
}
