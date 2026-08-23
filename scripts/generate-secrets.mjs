import { randomBytes } from "crypto";

const tokenKey = randomBytes(32).toString("hex");
const couponSecret = randomBytes(32).toString("hex");
const webhookToken = `nocaute-${randomBytes(16).toString("hex")}`;

console.log("# Cole na Vercel, Railway e .env.local");
console.log(`TOKEN_ENCRYPTION_KEY=${tokenKey}`);
console.log(`COUPON_HMAC_SECRET=${couponSecret}`);
console.log(`WEBHOOK_VERIFY_TOKEN=${webhookToken}`);
