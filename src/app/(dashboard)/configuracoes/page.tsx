import { StageHud } from "@/components/configuracoes/StageHud";
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
      <div className="grid w-full grid-cols-1 gap-3 lg:h-[min(520px,calc(100%-0.25rem))] lg:grid-cols-3">
        <section className="flex min-h-0 flex-col lg:h-full">
          <StageHud
            step={1}
            title="Loja"
            done={storeReady}
            doneLabel="Loja · etapa realizada"
            pendingHint="Preenche e salva o perfil da casa"
          />
          <StoreProfileForm
            name={store.storeName}
            city={store.city}
            logoUrl={store.logoUrl}
            menuUrl={store.menuUrl}
            address={store.address}
            hoursText={store.hoursText}
          />
        </section>

        <section className="flex min-h-0 flex-col lg:h-full">
          <StageHud
            step={2}
            title="WhatsApp Meta"
            done={connected}
            doneLabel="WhatsApp Meta · etapa realizada"
            pendingHint="Popup da Meta · QR no celular"
          />
          <WhatsAppConnectPanel connection={store.whatsapp} />
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
                  <Link
                    href="/clientes"
                    className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#E9EDEF] bg-white px-3 text-sm font-semibold text-[#111B21]"
                  >
                    Base de Clientes
                  </Link>
                </>
              ) : (
                <p className="text-sm text-[#667781]">
                  No passo 2 abre o popup da Meta (QR no celular). O número da loja aparece aqui
                  depois.
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
