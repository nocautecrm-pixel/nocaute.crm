import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[#F0F2F5] px-4 py-10">
      <article className="mx-auto max-w-2xl rounded-xl border border-[#E9EDEF] bg-white p-6 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#667781]">
          {BRAND.productName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111B21]">{title}</h1>
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#3B4A54]">{children}</div>
        <p className="mt-8 text-xs text-[#667781]">
          <Link href="/login" className="font-semibold text-emerald-700">
            Voltar ao login
          </Link>
          {" · "}
          <Link href="/privacidade" className="hover:underline">
            Privacidade
          </Link>
          {" · "}
          <Link href="/termos" className="hover:underline">
            Termos
          </Link>
          {" · "}
          <Link href="/opt-in" className="hover:underline">
            Opt-in
          </Link>
        </p>
      </article>
    </div>
  );
}
