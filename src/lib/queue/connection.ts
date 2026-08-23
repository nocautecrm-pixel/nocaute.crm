import IORedis from "ioredis";
import { isRedisConfigured } from "@/lib/config";

let redis: IORedis | null = null;

export function getQueueConnection() {
  if (!isRedisConfigured()) return null;
  if (!redis) {
    const url = process.env.REDIS_URL!;
    redis = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      family: 0,
      tls: url.startsWith("rediss://") ? {} : undefined,
    });
  }
  return redis;
}
