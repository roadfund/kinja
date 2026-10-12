import { OrderStatus } from "@/domain/model";
import type { OrderRow } from "@/market/orders";

export type OrderSearchParams = Promise<{ year?: string; month?: string; distributor?: string; status?: string; currency?: string }>;

// Reads the period, distributor and status filters from a page's query string.
export async function orderParams(searchParams: OrderSearchParams) {
  const { year, month, distributor, status, currency } = await searchParams;
  const parsed = OrderStatus.safeParse(status);
  return { filters: { year, month, distributorId: distributor, currency }, status: parsed.success ? parsed.data : undefined };
}

// Names used before, suggested when recording who delivered an order.
export const deliveredByNames = (orders: OrderRow[]) => [...new Set(orders.map((order) => order.deliveredBy).filter((name): name is string => Boolean(name)))].sort();
