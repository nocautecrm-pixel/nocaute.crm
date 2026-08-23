import { CustomerBoard } from "@/components/clientes/CustomerBoard";
import { isDemoMode } from "@/lib/config";
import { RECENCY_SEGMENTS } from "@/lib/segments/recency";
import { listCustomers } from "@/server/customers";
import { getCurrentRestaurantId } from "@/server/tenant";
import type { Customer, RecencySegment } from "@/types/database";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ segmento?: string }>;
}) {
  const params = await searchParams;
  const segmento = isSegment(params.segmento) ? params.segmento : undefined;
  const restaurantId = await getCurrentRestaurantId();
  const rows = await listCustomers(segmento, restaurantId);
  const customers: Customer[] = rows.map((row) => ({
    id: row.id,
    restaurantId: row.restaurantId,
    name: row.name,
    phone: row.phone,
    lastPurchaseAt: row.lastPurchaseAt,
    optIn: row.optIn,
    optInAt: row.optInAt,
    optInSource: row.optInSource,
    optInProof: row.optInProof,
    createdAt: row.createdAt,
  }));

  return (
    <CustomerBoard customers={customers} demo={isDemoMode()} segmento={segmento} />
  );
}

function isSegment(value?: string): value is RecencySegment {
  return Boolean(value && value in RECENCY_SEGMENTS);
}
