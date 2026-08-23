import { getQueueConnection } from "@/lib/queue/connection";

export class RateLimitError extends Error {
  readonly retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super("Muitas tentativas. Aguarde um momento e tente de novo.");
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

type WindowState = { count: number; resetAt: number };

const windows = new Map<string, WindowState>();

export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const redis = getQueueConnection();
  if (redis) {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    if (count > limit) {
      const ttlMs = await redis.pttl(redisKey);
      throw new RateLimitError(Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000)));
    }
    return;
  }

  const now = Date.now();
  const current = windows.get(key);

  if (!current || now >= current.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    throw new RateLimitError(Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  }

  current.count += 1;
}
