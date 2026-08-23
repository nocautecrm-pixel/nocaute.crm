import { ingestWhatsAppPayload } from "@/server/webhooks";
import type { WebhookIngestJob } from "@/lib/queue/jobs";

export async function processWebhookIngest(job: WebhookIngestJob) {
  return ingestWhatsAppPayload(job.rawBody);
}
