import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/auth/route-authorization";
import { HubSidebar } from "@/app/dashboard/hub/hub-sidebar";
import { RoleSidebar } from "@/app/dashboard/role-sidebar";

// The signed-in frame shared by /dashboard and /admin: the sidebar lives here, in the layout,
// so moving between pages only swaps the content and never reloads the menu.
export async function AppFrame({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/auth/login");
  const role = account.membership?.role;
  const sidebar = !role ? null : role === "HUB_ADMIN" ? <HubSidebar account={account} /> : <RoleSidebar account={account} />;
  return <main className="min-h-screen bg-[var(--kinja-cream)] lg:flex">{sidebar}<div className="min-w-0 flex-1">{children}</div></main>;
}
