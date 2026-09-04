import Link from "next/link";
import { ArrowRight, Ban, Megaphone, Wrench } from "lucide-react";
import { btnPrimaryClass, btnSecondaryClass, cardClass, eyebrowClass } from "@/components/ui/tokens";
import type { Advice } from "@/lib/advisor/types";

const KIND_ICON = {
  campaign: Megaphone,
  ops: Wrench,
  hold: Ban,
} as const;

function hrefFor(item: Advice) {
  if (item.action.type === "prefill_campaign") {
    return `/campanhas?advice=${encodeURIComponent(item.id)}`;
  }
  if (item.action.type === "navigate") return item.action.href;
  return null;
}

export function AdviceBoard({ items }: { items: Advice[] }) {
  const featured = items[0];
  const rest = items.slice(1);
  if (!featured) return null;

  const FeaturedIcon = KIND_ICON[featured.kind];
  const featuredHref = hrefFor(featured);

  return (
    <section className={`${cardClass} shrink-0 p-4`}>
      <p className={eyebrowClass}>Nocaute sugere</p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#111B21]">
            <FeaturedIcon className="h-4 w-4 shrink-0 text-emerald-700" strokeWidth={1.75} />
            {featured.title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#667781]">{featured.why}</p>
        </div>
        {featuredHref ? (
          <Link
            href={featuredHref}
            className={`${featured.kind === "campaign" ? btnPrimaryClass : btnSecondaryClass} shrink-0`}
          >
            {featured.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      {rest.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {rest.map((item) => {
            const href = hrefFor(item);
            const Icon = KIND_ICON[item.kind];
            const inner = (
              <>
                <span className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#667781]" strokeWidth={1.75} />
                  <span>
                    <span className="block text-sm font-semibold text-[#111B21]">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#667781]">{item.why}</span>
                  </span>
                </span>
                {href ? (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    {item.ctaLabel}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={item.id}>
                {href ? (
                  <Link
                    href={href}
                    className="block rounded-lg border border-[#E9EDEF] bg-[#F0F2F5] px-3 py-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/60"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="rounded-lg border border-[#E9EDEF] bg-[#F0F2F5] px-3 py-2.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
