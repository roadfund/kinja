import { Plus, Store } from "lucide-react";
import { Badge, EmptyState, LinkButton } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import type { Customer } from "@/domain/model";
import { CustomerActions } from "./customer-actions";

export function CustomerTable({ customers, basePath }: { customers: Customer[]; basePath: string }) {
  if (customers.length === 0) return <EmptyState action={<LinkButton href={`${basePath}/new`} icon={<Plus size={17} aria-hidden="true" />}>Add customer</LinkButton>} description="Add the shops, traders and buyers you sell to." icon={<Store size={22} aria-hidden="true" />} title="No customers yet" />;
  return <DataTable muted={(customer) => Boolean(customer.archivedAt)} rowKey={(customer) => customer.id} rows={customers} columns={[
    { header: "Name", cell: (customer) => <span className="font-semibold text-[var(--kinja-green)]">{customer.name}</span> },
    { header: "Phone", cell: (customer) => customer.phone ?? "—" },
    { header: "Email", cell: (customer) => <span className="break-all">{customer.email ?? "—"}</span> },
    { header: "Address", cell: (customer) => customer.address ?? "—" },
    { header: "Status", cell: (customer) => customer.archivedAt ? <Badge tone="grey">Archived</Badge> : <Badge tone="green">Active</Badge> },
    { header: "", align: "right", className: "w-12", cell: (customer) => <CustomerActions archived={Boolean(customer.archivedAt)} customerId={customer.id} editHref={`${basePath}/${customer.id}/edit`} /> },
  ]} />;
}
