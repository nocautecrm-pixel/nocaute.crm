import { createHmac, randomBytes } from "crypto";
import { isDemoMode } from "@/lib/config";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hmacSecret() {
  const secret = process.env.COUPON_HMAC_SECRET?.trim();
  if (secret) return secret;
  if (isDemoMode()) return "dev-only-change-me";
  throw new Error("COUPON_HMAC_SECRET ausente.");
}

export function generateCouponCode(campaignId: string, customerId: string) {
  const digest = createHmac("sha256", hmacSecret())
    .update(`${campaignId}:${customerId}`)
    .digest();

  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[digest[i] % ALPHABET.length];
  }
  return `MF-${code}`;
}

export function randomCouponSalt() {
  return randomBytes(4).toString("hex");
}

export const COUPON_PATTERN = /\b(?:MF-[A-Z0-9]{6}|[A-Z]{3,12}\d{2,4})\b/i;
