import Link from "next/link";
import { ProductLogo } from "@/components/brand/ProductLogo";
import { WhatsAppDoodles } from "@/components/auth/WhatsAppDoodles";
import { BRAND } from "@/lib/brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-y-auto bg-[#E5DDD5] px-4 py-10">
      <WhatsAppDoodles className="pointer-events-none absolute inset-0 h-full w-full" />
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${BRAND.authBackgroundUrl}")` }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[#111B21]/5" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <ProductLogo size="lg" className="mx-auto shadow-sm" />
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#111B21]/70">
            {BRAND.productName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111B21]">{title}</h1>
          <p className="mt-2 text-sm text-[#3B4A54]">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-[#E9EDEF] bg-white/95 p-6 shadow-[0_8px_24px_rgba(11,20,26,0.12)] backdrop-blur-sm">
          {children}
        </div>

        {footer ? <div className="mt-6 text-center text-sm text-[#3B4A54]">{footer}</div> : null}

        <p className="mt-8 text-center text-[11px] text-[#3B4A54]">
          <Link href="/privacidade" className="hover:underline">
            Privacidade
          </Link>
          {" · "}
          <Link href="/termos" className="hover:underline">
            Termos
          </Link>
          {" · "}
          <Link href="/opt-in" className="hover:underline">
            Opt-in no caixa
          </Link>
        </p>
      </div>
    </div>
  );
}

export function AuthLink(props: React.ComponentProps<typeof Link>) {
  return <Link {...props} className="font-semibold text-emerald-700 hover:text-emerald-800" />;
}
