import { notFound } from "next/navigation";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { CustomerForm } from "@/components/market/customer-form";
import { getCustomer } from "@/market/market-service";

export default async function EditCustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const customer = await getCustomer(account, (await params).customerId);
  if (!customer) notFound();
  return <DashboardShell back={{ href: "/dashboard/distributor/customers", label: "Customers" }} eyebrow="Kinja Market" title={customer.name}><CustomerForm backHref="/dashboard/distributor/customers" customer={customer} /></DashboardShell>;
}
