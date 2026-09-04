import { ProductLogo } from "@/components/brand/ProductLogo";
import { BRAND } from "@/lib/brand";
import { isProductionRuntime, missingLiveBackendEnv } from "@/lib/config";

export default function IndisponivelPage() {
  const missing = missingLiveBackendEnv();
  const production = isProductionRuntime();

  return (
    <main className="flex min-h-full items-center justify-center bg-[#F0F2F5] px-6 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-[#E9EDEF] bg-white p-8 shadow-sm">
        <ProductLogo size="md" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
          {BRAND.productName}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#111B21]">
          Sistema indisponível
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#667781]">
          {production
            ? "Este ambiente está em produção e não abre em modo demonstração. Sem banco e chave de serviço, o painel não sobe com dados fake."
            : "O backend real não está configurado. Para abrir o painel de verdade, preencha o Supabase. Demo local só com ALLOW_DEMO=true — e isso nunca vale em produção."}
        </p>

        {missing.length > 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Variáveis ausentes
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs text-amber-900">
              {missing.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 text-xs leading-5 text-[#667781]">
          Preencha <code className="rounded bg-[#F0F2F5] px-1">.env.local</code> (local) ou as
          envs da Vercel / Railway. Depois faça um novo deploy.
        </p>
      </section>
    </main>
  );
}
