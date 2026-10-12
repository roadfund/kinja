import { ShieldCheck } from "lucide-react";
import { listPendingHubs } from "@/admin/hub-review-service";
import { requireDashboardRole } from "@/auth/route-authorization";
import { HubReviewCard } from "./hub-review-card";
import { countries } from "@/config/countries";

export default async function HubReviewPage() {
  const account = await requireDashboardRole(["TECH_ADMIN"]);
  const hubs = await listPendingHubs(account);
  return <section className="px-6 py-8 sm:px-10">
    <header className="flex items-center gap-3"><ShieldCheck className="text-[var(--kinja-green)]" size={22} aria-hidden="true" /><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--kinja-green)]">Kinja Ops</p><h1 className="mt-1 text-2xl font-semibold text-[var(--kinja-green)]">Hub verification</h1></div></header>
    <p className="mt-8 max-w-2xl text-[#5d685e]">Review submitted business details before a hub can invite members or run payouts.</p>
    <div className="mt-8 grid gap-4">{hubs.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-[#5d685e]">No hubs are waiting for review.</p> : hubs.map((hub) => <HubReviewCard countryName={countries.find((country) => country.id === hub.countryId)?.name} initialHub={hub} key={hub.id} />)}</div>
  </section>;
}
