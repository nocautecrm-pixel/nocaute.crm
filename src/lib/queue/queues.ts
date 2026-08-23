import { Queue } from "bullmq";
import { getQueueConnection } from "@/lib/queue/connection";
import type {
  CampaignOfferJob,
  CampaignSendJob,
  WebhookIngestJob,
} from "@/lib/queue/jobs";

export const CAMPAIGN_SEND_QUEUE = "campaign-send";
export const CAMPAIGN_OFFER_QUEUE = "campaign-offer";
export const WEBHOOK_INGEST_QUEUE = "webhook-ingest";

function connectionOrThrow() {
  const connection = getQueueConnection();
  if (!connection) {
    throw new Error("REDIS_URL ausente. A fila de disparo precisa do Redis.");
  }
  return connection;
}

const retryOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 15_000 },
  removeOnComplete: 500,
  removeOnFail: 1000,
};

export function getCampaignSendQueue() {
  return new Queue<CampaignSendJob>(CAMPAIGN_SEND_QUEUE, {
    connection: connectionOrThrow(),
    defaultJobOptions: retryOptions,
  });
}

export function getCampaignOfferQueue() {
  return new Queue<CampaignOfferJob>(CAMPAIGN_OFFER_QUEUE, {
    connection: connectionOrThrow(),
    defaultJobOptions: retryOptions,
  });
}

export function getWebhookIngestQueue() {
  return new Queue<WebhookIngestJob>(WEBHOOK_INGEST_QUEUE, {
    connection: connectionOrThrow(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1000,
    },
  });
}
