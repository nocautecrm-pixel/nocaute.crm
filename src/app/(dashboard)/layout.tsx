import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BackendUnavailableError } from "@/lib/config";
import { getStorePanel } from "@/server/store";
import { AuthRequiredError, StoreRequiredError } from "@/server/tenant";

async function loadStorePanel() {
  try {
    return await getStorePanel();
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      redirect("/indisponivel");
    }
    if (error instanceof AuthRequiredError) {
      redirect("/login");
    }
    if (error instanceof StoreRequiredError) {
      redirect("/completar-cadastro");
    }
    throw error;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await loadStorePanel();
  return <DashboardShell store={store}>{children}</DashboardShell>;
}
