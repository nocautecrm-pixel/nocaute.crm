import { NextResponse } from "next/server";
import { BackendUnavailableError } from "@/lib/config";
import { RateLimitError } from "@/lib/rate-limit";
import { AuthRequiredError, StoreRequiredError } from "@/server/tenant";

export function jsonRouteError(error: unknown, fallback: string) {
  if (error instanceof BackendUnavailableError) {
    return NextResponse.json({ error: "Sistema indisponível." }, { status: 503 });
  }
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }
  if (error instanceof StoreRequiredError) {
    return NextResponse.json({ error: "Loja não encontrada. Complete o cadastro." }, { status: 403 });
  }
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: error.message },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } },
    );
  }
  const message = error instanceof Error ? error.message : fallback;
  if (message === "Campanha não encontrada nesta loja.") {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}
