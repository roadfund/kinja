import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { CustomerForm } from "@/components/market/customer-form";

export default async function NewCustomerPage() {
  await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  return <DashboardShell back={{ href: "/dashboard/distributor/customers", label: "Customers" }} eyebrow="Kinja Market" title="Add customer"><CustomerForm backHref="/dashboard/distributor/customers" /></DashboardShell>;
}
