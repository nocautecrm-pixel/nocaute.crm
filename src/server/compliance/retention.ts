import { BackendUnavailableError } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const RETENTION_DAYS = 30;
const BATCH = 500;

export async function anonymizeCampaignLogsOlderThan(days = RETENTION_DAYS) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new BackendUnavailableError();

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: jobs, error: jobsError } = await admin
    .from("campaign_jobs")
    .select("id")
    .lt("sent_at", cutoff)
    .or("provider_message_id.not.is.null,optin_wamid.not.is.null,offer_wamid.not.is.null,error_message.not.is.null")
    .limit(BATCH);

  if (jobsError) throw jobsError;

  const jobIds = (jobs ?? []).map((row) => row.id as string);
  let jobsAnonymized = 0;
  if (jobIds.length) {
    const { error } = await admin
      .from("campaign_jobs")
      .update({
        provider_message_id: null,
        optin_wamid: null,
        offer_wamid: null,
        error_message: null,
      })
      .in("id", jobIds);
    if (error) throw error;
    jobsAnonymized = jobIds.length;
  }

  const { data: events, error: eventsError } = await admin
    .from("message_events")
    .select("id")
    .lt("created_at", cutoff)
    .not("payload", "eq", "{}")
    .limit(BATCH);

  if (eventsError) throw eventsError;

  const eventIds = (events ?? []).map((row) => row.id as string);
  let eventsAnonymized = 0;
  if (eventIds.length) {
    const { error } = await admin
      .from("message_events")
      .update({ payload: {}, wamid: null })
      .in("id", eventIds);
    if (error) throw error;
    eventsAnonymized = eventIds.length;
  }

  return { anonymized: jobsAnonymized + eventsAnonymized, jobsAnonymized, eventsAnonymized };
}
