import { Queue } from "bullmq";
import Redis from "ioredis";

const mode = process.argv[2] || "inspect";
if (!["inspect", "pause", "resume"].includes(mode)) throw new Error("Unknown queue operation.");
if (!process.env.REDIS_URL) throw new Error("Redis is not configured.");
const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null,
  connectTimeout: 10_000, retryStrategy: () => null });
connection.on("error", () => {});
const queues = ["campaign-send", "campaign-offer"].map(name => new Queue(name, {connection}));
for (const queue of queues) queue.on("error", () => {});
try {
  for (const queue of queues) {
    if (mode === "pause") await queue.pause();
    if (mode === "resume") await queue.resume();
    console.log(JSON.stringify({ queue: queue.name, paused: await queue.isPaused(),
      counts: await queue.getJobCounts("active", "waiting", "delayed", "failed", "completed", "paused"),
      workers: (await queue.getWorkers()).length }));
  }
} catch (error) {
  console.error(JSON.stringify({ error: error.code || error.name }));
  process.exitCode = 1;
} finally {
  await Promise.all(queues.map(queue => queue.close().catch(() => {})));
  connection.disconnect();
}
