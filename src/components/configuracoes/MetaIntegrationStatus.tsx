import { StatusDot } from "@/components/ui/StatusDot";
import { eyebrowClass, insetClass } from "@/components/ui/tokens";
import { formatWhatsAppPhone, qualityLabel } from "@/lib/whatsapp/display";
import type { StorePanel } from "@/types/store";

export function MetaIntegrationStatus({ store }: { store: StorePanel }) {
  const ready = store.meta.ready;
  const phone =
    formatWhatsAppPhone(store.whatsapp.displayPhone) ?? store.whatsapp.displayPhone;
  const verifiedName = store.whatsapp.verifiedName?.trim() || store.storeName;
  const quality = qualityLabel(store.whatsapp.qualityRating);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <p className={eyebrowClass}>WhatsApp da loja</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
            Tudo linkado com a Meta
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-tight ${
            ready
              ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
              : "border-amber-200/80 bg-amber-50/80 text-amber-700"
          }`}
        >
          <StatusDot tone={ready ? "live" : "pending"} />
          {ready ? (phone ? `Conectado · ${phone}` : "Conectado") : "Ainda não linkado"}
        </span>
      </div>

      <ul className="mt-3 min-h-0 flex-1 divide-y divide-slate-200/70 overflow-y-auto rounded-lg border border-slate-200/80">
        {store.meta.items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
            <StatusDot tone={item.ok ? "live" : "idle"} />
            <div className="min-w-0">
              <p className="text-sm font-medium tracking-tight text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid shrink-0 grid-cols-3 gap-2 text-sm">
        <div className={insetClass}>
          <dt className="font-medium text-slate-500">Número</dt>
          <dd className="mt-1 font-semibold tracking-tight text-slate-900">{phone ?? "—"}</dd>
        </div>
        <div className={insetClass}>
          <dt className="font-medium text-slate-500">Nome no WhatsApp</dt>
          <dd className="mt-1 font-semibold tracking-tight text-slate-900">
            {store.whatsapp.connected ? verifiedName : "—"}
          </dd>
        </div>
        <div className={insetClass}>
          <dt className="font-medium text-slate-500">Qualidade da conta</dt>
          <dd className="mt-1 font-semibold tracking-tight text-slate-900">
            {store.whatsapp.connected ? (quality ?? "—") : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
