import { composeChatbotReply, type StoreFacts } from "@/lib/chatbot/dna";
import { customerCareWindow } from "@/lib/chatbot/window";
import { isDemoMode } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/whatsapp/service";
import { getBrandDnaForRestaurant } from "@/server/chatbot";
import { getConnectedWhatsAppAccount } from "@/server/whatsapp-account";

export async function replyWithBrandDna(input: {
  restaurantId: string;
  storeName: string;
  to: string;
  customerMessage: string;
}) {
  if (isDemoMode()) return { sent: false as const, demo: true as const };

  const admin = createSupabaseAdminClient();
  if (!admin) return { sent: false as const, reason: "no_admin" as const };

  const [{ data: account }, { data: restaurant }, dna] = await Promise.all([
    admin
      .from("whatsapp_accounts")
      .select("last_inbound_at")
      .eq("restaurant_id", input.restaurantId)
      .maybeSingle(),
    admin
      .from("restaurants")
      .select("menu_url, address, hours_text, name")
      .eq("id", input.restaurantId)
      .maybeSingle(),
    getBrandDnaForRestaurant(input.restaurantId),
  ]);

  const window = customerCareWindow(account?.last_inbound_at ?? null);
  if (!window.open) {
    return { sent: false as const, reason: "window_closed" as const };
  }

  const facts: StoreFacts = {
    hoursText: restaurant?.hours_text ?? "",
    menuUrl: restaurant?.menu_url ?? "",
    address: restaurant?.address ?? "",
  };

  const body = composeChatbotReply({
    dna,
    storeName: restaurant?.name || input.storeName,
    customerMessage: input.customerMessage,
    facts,
  });

  try {
    const credentials = await getConnectedWhatsAppAccount(input.restaurantId);
    const result = await sendTextMessage(credentials, { to: input.to, body });
    return { sent: true as const, wamid: result.wamid, body };
  } catch {
    return { sent: false as const, body };
  }
}
