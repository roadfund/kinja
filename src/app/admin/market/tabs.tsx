import { SectionTabs } from "@/components/kinja/ui";

type Tab = "Orders" | "SKUs" | "Customers" | "Sales" | "Invoices";

export function MarketTabs({ active, counts = {} }: { active: Tab; counts?: { orders?: number; customers?: number; sales?: number; invoices?: number } }) {
  return <SectionTabs active={active} tabs={[{ label: "Orders", href: "/admin/market/orders", count: counts.orders }, { label: "SKUs", href: "/admin/market/skus" }, { label: "Customers", href: "/admin/market", count: counts.customers }, { label: "Sales", href: "/admin/market/sales", count: counts.sales }, { label: "Invoices", href: "/admin/market/invoices", count: counts.invoices }]} />;
}
