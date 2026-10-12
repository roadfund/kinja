import Link from "next/link";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, formatDate } from "@/components/kinja/ui";
import { InvoiceForm } from "@/components/market/invoice-form";
import { formatQuantity, toThousandths } from "@/domain/money";
import { getMoneyContext } from "@/admin/exchange-rates";
import { listCustomers, listSales, saleNetMinor } from "@/market/market-service";

export default async function NewInvoicePage() {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const [customers, sales, money] = await Promise.all([listCustomers(account, { includeArchived: true }), listSales(account), getMoneyContext(account.hub!)]);
  const open = sales.filter((sale) => sale.invoiceable && sale.distributorId === account.scope.organizationId);
  const withSales = customers.filter((customer) => open.some((sale) => sale.customerId === customer.id));
  return <DashboardShell back={{ href: "/dashboard/distributor/invoices", label: "Invoices" }} eyebrow="Kinja Market" title="Issue an invoice">
    {withSales.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">Nothing to invoice. Orders can be invoiced once they are delivered. <Link className="font-semibold text-[var(--kinja-green)] underline" href="/dashboard/distributor/orders">See orders</Link></p>
      : <InvoiceForm money={money} customers={withSales.map(({ id, name, paymentTermsDays }) => ({ id, name, paymentTermsDays }))} sales={open.map((sale) => ({ id: sale.id, customerId: sale.customerId, amountMinor: saleNetMinor(sale), currency: sale.currency, at: sale.soldAt, label: `${sale.orderLabel ? `${sale.orderLabel} · ` : ""}${formatDate(sale.soldAt)} · ${sale.productName} (${sale.batchLabel}) · ${formatQuantity(toThousandths(sale.quantity), sale.unit)}` }))} />}
  </DashboardShell>;
}
