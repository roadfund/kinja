import { notFound } from "next/navigation";
import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { CustomerForm } from "@/components/market/customer-form";
import { getCustomer } from "@/market/market-service";

export default async function HubEditCustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const customer = await getCustomer(account, (await params).customerId);
  if (!customer) notFound();
  return <DashboardShell back={{ href: "/admin/market", label: "Customers" }} eyebrow="Kinja Market" title={customer.name}><CustomerForm backHref="/admin/market" customer={customer} /></DashboardShell>;
}
