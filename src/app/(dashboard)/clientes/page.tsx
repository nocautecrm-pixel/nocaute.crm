import { CustomerBoard } from "@/components/clientes/CustomerBoard";
import { isDemoMode } from "@/lib/config";
import { getCustomerBoard } from "@/server/customer-board";
import { getCurrentRestaurantId } from "@/server/tenant";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ publico?: string }>;
}) {
  const params = await searchParams;
  const restaurantId = await getCurrentRestaurantId();
  const board = await getCustomerBoard(restaurantId);
  const publico = board.audiences.some((audience) => audience.slug === params.publico)
    ? params.publico
    : undefined;

  return (
    <CustomerBoard
      customers={board.customers}
      audiences={board.audiences}
      freshness={board.freshness}
      demo={isDemoMode()}
      publico={publico}
    />
  );
}
