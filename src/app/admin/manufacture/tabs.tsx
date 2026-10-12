import { SectionTabs } from "@/components/kinja/ui";

export function ManufactureTabs({ active, counts }: { active: "Transfers" | "Batches"; counts: { transfers: number; batches: number } }) {
  return <SectionTabs active={active} tabs={[{ label: "Transfers", href: "/admin/manufacture", count: counts.transfers }, { label: "Batches", href: "/admin/manufacture/batches", count: counts.batches }]} />;
}
