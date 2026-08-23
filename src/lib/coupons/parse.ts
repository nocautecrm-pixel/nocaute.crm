import { COUPON_PATTERN } from "@/lib/coupons/generate";

export function extractCouponCode(text: string) {
  const match = text.toUpperCase().match(COUPON_PATTERN);
  return match ? match[0].toUpperCase() : null;
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}
