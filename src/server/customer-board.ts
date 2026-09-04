import { describeListFreshness, type ListFreshness } from "@/lib/customers/list-freshness";
import type { AudienceWithCount } from "@/lib/audiences/types";
import type { Customer } from "@/types/database";
import { listAudiences } from "@/server/audiences";
import {
  getCustomersImportedAt,
  listCustomers,
  toPublicCustomer,
} from "@/server/customers";

export type CustomerBoardData = {
  customers: Customer[];
  audiences: AudienceWithCount[];
  freshness: ListFreshness;
};

export async function getCustomerBoard(restaurantId: string): Promise<CustomerBoardData> {
  const [rows, audiences, importedAt] = await Promise.all([
    listCustomers(undefined, restaurantId),
    listAudiences(restaurantId),
    getCustomersImportedAt(restaurantId),
  ]);
  const customers = rows.map(toPublicCustomer);
  return {
    customers,
    audiences,
    freshness: describeListFreshness({
      importedAt,
      customerCount: customers.length,
    }),
  };
}
