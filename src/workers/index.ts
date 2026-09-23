import { createServer } from "http";
import { Worker } from "bullmq";
import { BRAND } from "@/lib/brand";
import { getSendRateLimit, isRedisConfigured, missingWorkerEnv } from "@/lib/config";
import { getQueueConnection } from "@/lib/queue/connection";
import {
  CAMPAIGN_OFFER_QUEUE,
  CAMPAIGN_SEND_QUEUE,
  WEBHOOK_INGEST_QUEUE,
} from "@/lib/queue/queues";
import { processCampaignOffer } from "@/workers/send-offer";
import { processCampaignSend } from "@/workers/send-campaign";
import { processWebhookIngest } from "@/workers/ingest-webhook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

let ready = false;

function listenHealth(port: string) {
  createServer((req, res) => {
    const live = req.url === "/live";
    res.writeHead(live || ready ? 200 : 503, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ service: BRAND.productName, ready }));
  }).listen(Number(port), () => {
    console.log(`Health check em :${port}`);
  });
}

async function main() {
  if (process.env.PORT) listenHealth(process.env.PORT);
  const missing = missingWorkerEnv();
  if (missing.length) {
    console.warn(
      `Worker no ar, aguardando variáveis: ${missing.join(", ")}. Cole no Railway (mesmo Supabase da Vercel) e faça redeploy.`,
    );
    return;
  }

  if (!isRedisConfigured()) {
    console.error("REDIS_URL ausente. No Railway: adicione o plugin Redis e copie REDIS_URL.");
    process.exit(1);
  }

  const connection = getQueueConnection()!;
  const limiter = getSendRateLimit();

  const sendWorker = new Worker(
    CAMPAIGN_SEND_QUEUE,
    async (job) => processCampaignSend(job),
    { connection, limiter, concurrency: 1 },
  );

  const offerWorker = new Worker(
    CAMPAIGN_OFFER_QUEUE,
    async (job) => processCampaignOffer(job),
    { connection, limiter, concurrency: 1 },
  );

  const ingestWorker = new Worker(
    WEBHOOK_INGEST_QUEUE,
    async (job) => processWebhookIngest(job.data),
    { connection, concurrency: 4 },
  );

  sendWorker.on("completed", (job) => console.log(`[opt-in] ok ${job.id}`));
  sendWorker.on("failed", (job, error) =>
    console.error(`[opt-in] fail ${job?.id}:`, error.message),
  );
  offerWorker.on("completed", (job) => console.log(`[offer] ok ${job.id}`));
  offerWorker.on("failed", (job, error) =>
    console.error(`[offer] fail ${job?.id}:`, error.message),
  );
  ingestWorker.on("failed", (job, error) =>
    console.error(`[ingest] fail ${job?.id}:`, error.message),
  );

  const workers = [sendWorker, offerWorker, ingestWorker];
  for (const worker of workers) {
    worker.on("error", () => { ready = false; });
    worker.on("closed", () => { ready = false; });
  }
  await Promise.all(workers.map((worker) => worker.waitUntilReady()));
  let checking = false;
  async function checkReadiness() {
    if (checking) return;
    checking = true;
    try {
      const admin = createSupabaseAdminClient();
      if (!admin || connection.status !== "ready" || workers.some((worker) => !worker.isRunning())) {
        ready = false;
        return;
      }
      const schema = await admin.from("delivery_attempts").select("campaign_job_id", { head: true })
        .limit(1).abortSignal(AbortSignal.timeout(3_000));
      ready = !schema.error && connection.status === "ready" && workers.every((worker) => worker.isRunning());
    } catch { ready = false; }
    finally { checking = false; }
  }
  await checkReadiness();
  const healthTimer = setInterval(() => { void checkReadiness(); }, 5_000);
  const shutdown = async () => {
    ready = false;
    clearInterval(healthTimer);
    await Promise.all(workers.map((worker) => worker.close()));
    await connection.quit();
    process.exit(0);
  };
  process.once("SIGTERM", () => { void shutdown(); });
  process.once("SIGINT", () => { void shutdown(); });

  console.log(
    `Worker ${BRAND.productName} ativo. Rate limit: ${limiter.max} msg / ${limiter.duration}ms (opt-in + oferta)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
