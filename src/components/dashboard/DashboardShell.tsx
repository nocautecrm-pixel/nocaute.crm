"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Menu,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProductLogo } from "@/components/brand/ProductLogo";
import { StatusDot } from "@/components/ui/StatusDot";
import { formatWhatsAppPhone } from "@/lib/whatsapp/display";
import type { StorePanel } from "@/types/store";

const startLinks = [
  { href: "/visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/configuracoes", label: "Conectar", icon: Smartphone },
];

const workLinks = [
  { href: "/clientes", label: "Base de Clientes", icon: Users },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/resultados", label: "Relatórios", icon: BarChart3 },
];

const billingLink = { href: "/plano", label: "Plano", icon: CreditCard };

const viewCopy: Record<string, { title: string; hint: string }> = {
  "/visao-geral": {
    title: "Visão Geral",
    hint: "Nocaute sugere o próximo disparo com base na recência e no que já converteu.",
  },
  "/configuracoes": {
    title: "Conectar",
    hint: "WhatsApp da casa, nome, cardápio e horário.",
  },
  "/campanhas": {
    title: "Campanhas",
    hint: "Escolha um público. Destinatários: opt-in + faixa + limite Meta, na hora do envio.",
  },
  "/clientes": {
    title: "Base de Clientes",
    hint: "Bolinha verde, amarela ou vermelha pela última visita. Públicos Ativos, Em risco, Inativos e Perdidos — ou crie o seu.",
  },
  "/resultados": {
    title: "Relatórios",
    hint: "Enviado, entregue e cupom usado — sem receita inventada.",
  },
  "/plano": {
    title: "Plano",
    hint: "Franquia da ferramenta. Cobrança automática ainda não está no ar.",
  },
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm tracking-tight transition-colors duration-150 ${
        active
          ? "bg-[#2A3942] font-semibold text-white"
          : "font-medium text-[#8696A0] hover:bg-[#2A3942] hover:text-[#E9EDEF]"
      }`}
    >
      {active ? (
        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-emerald-500" />
      ) : null}
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

export function DashboardShell({
  store,
  children,
}: {
  store: StorePanel;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const connected = store.whatsapp.connected;
  const quotaPct = Math.min(
    100,
    Math.round((store.quota.used / Math.max(store.quota.included, 1)) * 100),
  );
  const quotaTone =
    quotaPct >= 100 ? "bg-red-600" : quotaPct >= 90 ? "bg-amber-500" : "bg-emerald-600";
  const phone = formatWhatsAppPhone(store.whatsapp.displayPhone);
  const viewKey = Object.keys(viewCopy).find(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
  const copy = viewCopy[viewKey ?? "/visao-geral"];

  return (
    <div className="flex h-full overflow-hidden bg-[#F0F2F5]">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#202C33] text-[#E9EDEF] transition-transform duration-150 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link
          href={connected ? "/visao-geral" : "/configuracoes"}
          className="flex items-center gap-3 px-4 py-4"
          onClick={() => setOpen(false)}
        >
          <ProductLogo size="sm" className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{store.productName}</p>
            <p className="truncate text-[11px] text-[#8696A0]">{store.storeName}</p>
          </div>
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col px-2 py-2">
          <div className="flex flex-col gap-1">
            {startLinks.map((link) => (
              <SideLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                active={isActive(pathname, link.href)}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-1 border-t border-[#2A3942] pt-4">
            {workLinks.map((link) => (
              <SideLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                active={isActive(pathname, link.href)}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>

          <div className="mt-auto border-t border-[#2A3942] pt-4">
            <SideLink
              href={billingLink.href}
              label={billingLink.label}
              icon={billingLink.icon}
              active={isActive(pathname, billingLink.href)}
              onClick={() => setOpen(false)}
            />
          </div>
        </nav>

        <div className="border-t border-[#2A3942] px-2 py-3">
          <LogoutButton />
          <div className="mt-2 px-2 text-[11px] leading-relaxed text-[#8696A0]">
            <p className="font-semibold text-[#E9EDEF]">
              {store.quota.planName} · {store.quota.used}/{store.quota.included}
            </p>
            <p className="truncate">{store.city || "Loja"}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#E9EDEF] px-4 lg:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-[#667781] lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Abrir menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight text-[#111B21]">
              {copy.title}
            </h1>
            <p className="hidden truncate text-xs text-[#667781] sm:block">{copy.hint}</p>
          </div>

          <div className="hidden min-w-[200px] sm:block">
            <p className="text-[11px] font-medium text-[#667781]">Franquia do mês</p>
            <p className="text-[13px] font-semibold text-[#111B21]">
              {store.quota.used} / {store.quota.included} leads
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#E9EDEF]">
              <div className={`h-full rounded-full ${quotaTone}`} style={{ width: `${quotaPct}%` }} />
            </div>
          </div>

          <Link
            href="/configuracoes"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              connected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            <StatusDot tone={connected ? "live" : "offline"} />
            {connected ? (phone ? `Conectado · ${phone}` : "Conectado") : "API offline"}
          </Link>
        </header>

        <main className="flex min-h-0 flex-1 flex-col px-4 py-4 lg:px-6">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
