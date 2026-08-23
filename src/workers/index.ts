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

function listenHealth(port: string) {
  createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`${BRAND.productName} worker ok`);
  }).listen(Number(port), () => {
    console.log(`Health check em :${port}`);
  });
}

async function main() {
  const missing = missingWorkerEnv();
  if (missing.length) {
    console.warn(
      `Worker no ar, aguardando variáveis: ${missing.join(", ")}. Cole no Railway (mesmo Supabase da Vercel) e faça redeploy.`,
    );
    if (process.env.PORT) listenHealth(process.env.PORT);
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

  if (process.env.PORT) listenHealth(process.env.PORT);

  console.log(
    `Worker ${BRAND.productName} ativo. Rate limit: ${limiter.max} msg / ${limiter.duration}ms (opt-in + oferta)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
