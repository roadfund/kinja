import Link from "next/link";
import type { Account } from "@/auth/server-store";
import { ProfileLink, SidebarNav, type NavItem } from "@/components/kinja/sidebar-nav";
import { SidebarUserCard } from "../sidebar-user-card";
import { BarChart3, Factory, LayoutDashboard, Leaf, LogOut, Package, ReceiptText, Settings2, ShoppingBag, UsersRound, WalletCards } from "lucide-react";

const items = [
  { label: "Overview", href: "/dashboard/hub", icon: LayoutDashboard, always: true },
  { label: "Hub setup", href: "/admin/setup", icon: Settings2, always: true },
  { label: "Team", href: "/admin/team", icon: UsersRound },
  { label: "Kinja Field", href: "/dashboard/hub?module=field", icon: Leaf },
  { label: "Kinja Pay", href: "/dashboard/hub?module=pay", icon: WalletCards },
  { label: "Manufacture", href: "/admin/manufacture", icon: Factory },
  { label: "Orders", href: "/admin/market/orders", icon: ReceiptText },
  { label: "SKUs", href: "/admin/market/skus", icon: Package },
  { label: "Market", href: "/admin/market", icon: ShoppingBag },
  { label: "Operations", href: "/admin/ops", icon: BarChart3 },
];

export function HubSidebar({ account }: { account: Account }) {
  const verified = account.hub?.status === "VERIFIED";
  const nav: NavItem[] = items.map((item) => { const Icon = item.icon; return { label: item.label, href: item.href, icon: <Icon size={17} aria-hidden="true" />, locked: !verified && !item.always }; });
  return <aside className="border-b border-[#dce2d9] bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r"><div className="px-6 py-5 lg:px-5"><Link className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--kinja-green)]" href="/"><Leaf aria-hidden="true" size={20} strokeWidth={2.5} />kinja<span className="text-[var(--kinja-yellow)]">.</span></Link></div><SidebarUserCard account={account} /><SidebarNav items={nav} label="Hub navigation" /><div className="flex items-center justify-between border-t border-[#eef1eb] px-4 py-4 lg:block lg:px-6"><ProfileLink icon={<UsersRound size={17} aria-hidden="true" />} /><Link className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#718074] lg:mt-4" href="/auth/logout" prefetch={false}><LogOut aria-hidden="true" size={14} />Sign out</Link></div></aside>;
}
