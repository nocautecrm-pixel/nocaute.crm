import Link from "next/link";
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
    <div className="flex min-h-full flex-1 items-center justify-center overflow-y-auto bg-[#F0F2F5] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#667781]">
            {BRAND.productName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111B21]">{title}</h1>
          <p className="mt-2 text-sm text-[#667781]">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-[#E9EDEF] bg-white p-6 shadow-[0_1px_3px_rgba(11,20,26,0.08)]">
          {children}
        </div>

        {footer ? <div className="mt-6 text-center text-sm text-[#667781]">{footer}</div> : null}

        <p className="mt-8 text-center text-[11px] text-[#8696A0]">
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
