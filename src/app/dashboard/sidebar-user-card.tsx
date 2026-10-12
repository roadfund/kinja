import Link from "next/link";
import type { Account } from "@/auth/server-store";
import { Avatar } from "@/components/avatar";

export function workspaceName(account: Account): string {
  return account.organization?.name ?? account.hub?.businessName ?? "Kinja platform";
}

export function SidebarUserCard({ account }: { account: Account }) {
  return <Link className="block border-t border-[#eef1eb] px-4 py-3 transition hover:bg-[#f0f4ed] lg:mx-3 lg:mt-3 lg:rounded-xl lg:border lg:bg-[#f7f9f5] lg:px-3" href="/dashboard/profile"><div className="flex items-center gap-3"><Avatar name={account.user.fullName} photoUrl={account.user.photoUrl} seed={account.user.id} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--kinja-green)]">{account.user.fullName}</p><p className="truncate text-xs text-[#718074]">{workspaceName(account)}</p></div></div></Link>;
}
