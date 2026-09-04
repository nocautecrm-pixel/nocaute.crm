"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { BRAND } from "@/lib/brand";

export function ProductLogo({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = size === "lg" ? "h-24 w-24" : size === "sm" ? "h-9 w-9" : "h-16 w-16";
  const px = size === "lg" ? 96 : size === "sm" ? 36 : 64;
  const icon = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-4 w-4" : "h-7 w-7";

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-white ${box} ${className}`.trim()}
        aria-label={BRAND.productName}
      >
        <MessageCircle className={icon} strokeWidth={1.75} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.logoUrl}
      alt={BRAND.productName}
      width={px}
      height={px}
      onError={() => setFailed(true)}
      className={`${box} overflow-hidden rounded-full object-cover ${className}`.trim()}
    />
  );
}
