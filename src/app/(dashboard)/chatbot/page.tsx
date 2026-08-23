import { CommandCenter } from "@/components/chatbot/CommandCenter";
import { getStorePanel } from "@/server/store";

export default async function ChatbotPage() {
  const store = await getStorePanel();
  return <CommandCenter store={store} />;
}
