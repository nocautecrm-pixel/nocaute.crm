import { randomBytes } from "crypto";
import { encryptSecret } from "@/lib/crypto";
import { BackendUnavailableError, getAppUrl } from "@/lib/config";
import { parseMetaSignedRequest } from "@/lib/meta/signed-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { eraseRestaurantPersonalData } from "@/server/compliance/erasure";

function appSecret() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET ausente.");
  return secret;
}

async function readSignedRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let signed: string | null = null;

  if (contentType.includes("application/json")) {
    const json = (await request.json()) as { signed_request?: string };
    signed = json.signed_request ?? null;
  } else {
    const text = await request.text();
    const params = new URLSearchParams(text);
    signed = params.get("signed_request");
  }

  if (!signed) throw new Error("signed_request ausente.");
  return parseMetaSignedRequest(signed, appSecret());
}

export async function handleMetaDeauth(request: Request) {
  const payload = await readSignedRequest(request);
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível para deauth.");
  if (!payload.user_id) throw new Error("user_id ausente no signed_request.");

  await admin
      .from("whatsapp_accounts")
      .update({
        status: "disconnected",
        access_token_encrypted: encryptSecret("REVOKED"),
        updated_at: new Date().toISOString(),
      })
      .eq("meta_user_id", payload.user_id);

  return { ok: true as const };
}

export async function handleMetaDataDeletion(request: Request) {
  const payload = await readSignedRequest(request);
  const confirmationCode = randomBytes(12).toString("hex");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin indisponível para exclusão de dados.");

  const { data: accounts } = payload.user_id
    ? await admin
        .from("whatsapp_accounts")
        .select("restaurant_id")
        .eq("meta_user_id", payload.user_id)
    : { data: [] as Array<{ restaurant_id: string }> };

  const restaurantIds = [...new Set((accounts ?? []).map((row) => row.restaurant_id).filter(Boolean))];
  let status: "completed" | "failed" = "completed";

  try {
    for (const restaurantId of restaurantIds) {
      await eraseRestaurantPersonalData(admin, restaurantId);
    }
  } catch {
    status = "failed";
  }

  const { error: insertError } = await admin.from("data_deletion_requests").insert({
    confirmation_code: confirmationCode,
    meta_user_id: payload.user_id ?? null,
    restaurant_id: restaurantIds[0] ?? null,
    status,
    completed_at: new Date().toISOString(),
  });
  if (insertError) throw insertError;

  const statusUrl = `${getAppUrl()}/api/meta/data-deletion/status?code=${confirmationCode}`;

  return {
    url: statusUrl,
    confirmation_code: confirmationCode,
  };
}

export async function getDataDeletionStatus(code: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new BackendUnavailableError();
  }

  const { data } = await admin
    .from("data_deletion_requests")
    .select("status, confirmation_code, created_at, completed_at")
    .eq("confirmation_code", code)
    .maybeSingle();

  if (!data) {
    return { status: "unknown" as const, confirmation_code: code };
  }

  return {
    status: data.status as string,
    confirmation_code: data.confirmation_code as string,
    created_at: data.created_at as string,
    completed_at: (data.completed_at as string | null) ?? null,
  };
}
