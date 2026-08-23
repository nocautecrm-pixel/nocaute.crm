import { redirect } from "next/navigation";
import { getStorePanel } from "@/server/store";

export default async function PainelPage() {
  const store = await getStorePanel();
  redirect(store.whatsapp.connected ? "/visao-geral" : "/configuracoes");
}
