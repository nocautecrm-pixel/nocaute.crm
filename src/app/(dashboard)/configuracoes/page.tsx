import { StageCard } from "@/components/configuracoes/StageHud";
import { StoreProfileForm } from "@/components/configuracoes/StoreProfileForm";
import { MetaIntegrationStatus } from "@/components/configuracoes/MetaIntegrationStatus";
import { WhatsAppConnectPanel } from "@/components/integracao/WhatsAppConnectPanel";
import { cardClass } from "@/components/ui/tokens";
import { getStorePanel } from "@/server/store";
import Link from "next/link";

export default async function ConfiguracoesPage() {
  const store = await getStorePanel();
  const connected = store.whatsapp.connected;
  const storeReady = Boolean(store.storeName.trim());

  return (
    <div className="flex h-full min-h-0 items-stretch justify-center overflow-y-auto lg:items-center lg:overflow-hidden">
      <div className="grid w-full grid-cols-1 gap-3 lg:h-[min(580px,calc(100%-0.25rem))] lg:grid-cols-3">
        <section className="flex min-h-0 flex-col lg:h-full">
          <StageCard
            step={1}
            title="Loja"
            done={storeReady}
            doneLabel="Loja etapa realizada"
            pendingHint="Preenche e salva o perfil da casa"
          >
            <StoreProfileForm
              bare
              name={store.storeName}
              city={store.city}
              logoUrl={store.logoUrl}
              menuUrl={store.menuUrl}
              address={store.address}
              hoursText={store.hoursText}
            />
          </StageCard>
        </section>

        <section className="flex min-h-0 flex-col lg:h-full">
          <StageCard
            step={2}
            title="WhatsApp Meta"
            done={connected}
            doneLabel="WhatsApp Meta etapa realizada"
            pendingHint="Mesmo número do celular · sem chip novo"
          >
            <WhatsAppConnectPanel bare connection={store.whatsapp} />
          </StageCard>
        </section>

        <section className="flex min-h-0 flex-col lg:h-full">
          <p className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-[#667781]">
            3 · Canal pronto {connected ? "✓" : ""}
          </p>
          <div className={`${cardClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E9EDEF] px-4 py-3">
              {connected ? (
                <>
                  <p className="text-sm text-[#667781]">Número e nome já vieram da Meta.</p>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href="/pagamento-meta"
                      className="inline-flex h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900"
                    >
                      Pagamento Meta
                    </Link>
                    <Link
                      href="/clientes"
                      className="inline-flex h-9 items-center rounded-lg border border-[#E9EDEF] bg-white px-3 text-sm font-semibold text-[#111B21]"
                    >
                      Base de Clientes
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#667781]">
                  No passo 2 conecte o WhatsApp da loja. O cartão das mensagens fica em{" "}
                  <Link href="/pagamento-meta" className="font-semibold text-emerald-800 underline-offset-2 hover:underline">
                    Pagamento Meta
                  </Link>
                  .
                </p>
              )}
            </div>
            <MetaIntegrationStatus store={store} />
          </div>
        </section>
      </div>
    </div>
  );
}
