import Link from "next/link";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { OrderForm } from "@/components/market/order-form";
import { fromThousandths } from "@/domain/money";
import { getMoneyContext } from "@/admin/exchange-rates";
import { distributorStock, listCustomers, listSales } from "@/market/market-service";
import { deliveredByNames } from "@/market/order-params";
import { hubToday, listOrders, orderCategoryLabels, orderChannelLabels } from "@/market/orders";

export default async function NewOrderPage() {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const [customers, stock, sales, orders, money] = await Promise.all([listCustomers(account), distributorStock(account.scope.hubId, account.scope.organizationId), listSales(account), listOrders(account), getMoneyContext(account.hub!)]);
  const available = stock.filter((row) => row.availableThousandths > 0);
  // Sales are newest first, so the first one per product and currency holds its latest price.
  const lastPrices = new Map<string, Record<string, number>>();
  for (const sale of sales) {
    if (sale.voidedAt) continue;
    const prices = lastPrices.get(sale.productId) ?? {};
    prices[sale.currency] ??= sale.unitPriceMinor;
    lastPrices.set(sale.productId, prices);
  }
  const missing = customers.length === 0 ? <>Add a customer first. <Link className="font-semibold text-[var(--kinja-green)] underline" href="/dashboard/distributor/customers/new">Add customer</Link></> : available.length === 0 ? <>You have no stock. <Link className="font-semibold text-[var(--kinja-green)] underline" href="/dashboard/distributor/stock">Confirm incoming shipments</Link></> : null;
  return <DashboardShell back={{ href: "/dashboard/distributor/orders", label: "Orders" }} eyebrow="Kinja Market" title="New order">
    {missing ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">{missing}</p> : <OrderForm categories={orderCategoryLabels} channels={orderChannelLabels} money={money} customers={customers.map(({ id, name }) => ({ id, name }))} deliveredByNames={deliveredByNames(orders)} stock={available.map((row) => ({ batchId: row.batchId, productId: row.productId, label: `${row.productName} · ${row.batchLabel}`, available: fromThousandths(row.availableThousandths), unitLabel: row.unit === "KG" ? "kg" : "units", lastPrices: lastPrices.get(row.productId) ?? {} }))} today={hubToday(account.hub!)} />}
  </DashboardShell>;
}
