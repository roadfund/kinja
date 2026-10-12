import { Leaf } from "lucide-react";
import { CooperativeShell } from "../cooperative-shell";

export default function CooperativeCropsPage() {
  return <CooperativeShell eyebrow="Kinja Field" title="Crops" description="Crops enabled by your hub and available for farmer records and deliveries."><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#cbded0] bg-white p-6"><Leaf className="text-[var(--kinja-green)]" size={22} aria-hidden="true" /><h2 className="mt-5 text-xl font-semibold text-[var(--kinja-green)]">Cassava</h2><p className="mt-2 text-sm text-[#5d685e]">Grades A, B, and Rejected</p></div><div className="rounded-2xl border border-[#cbded0] bg-white p-6"><Leaf className="text-[var(--kinja-green)]" size={22} aria-hidden="true" /><h2 className="mt-5 text-xl font-semibold text-[var(--kinja-green)]">Sweet potato</h2><p className="mt-2 text-sm text-[#5d685e]">Grades A, B, and Rejected</p></div></div></CooperativeShell>;
}