"use client";

import { Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";

type BatchOption = { id: string; label: string; remaining: string; unitLabel: string };

export function FinishedTransferForm({ distributors, batches }: { distributors: Array<{ id: string; name: string }>; batches: BatchOption[] }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const batch = batches.find((item) => item.id === batchId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (await run("/manufacture/transfers/finished", { toOrganizationId: data.get("toOrganizationId"), batchId, quantitySent: String(data.get("quantitySent")).trim(), note: data.get("note") })) {
      router.push("/dashboard/manufacturer/transfers");
      router.refresh();
    }
  }

  return <FormCard description="The distributor confirms how much arrived. Any difference is flagged." icon={<Truck size={20} aria-hidden="true" />} onSubmit={submit} title="Send finished goods">
    <div className="grid gap-5 sm:grid-cols-2">
      <Label required text="Distributor"><select className={inputClass} name="toOrganizationId" required><option value="">Select a distributor</option>{distributors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Label>
      <Label required text="Batch"><select className={inputClass} onChange={(event) => setBatchId(event.target.value)} required value={batchId}>{batches.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.remaining} {item.unitLabel} left</option>)}</select></Label>
      <Label required text={`Quantity (${batch?.unitLabel ?? "units"})`}><input className={inputClass} inputMode="decimal" max={batch?.remaining} min="0.001" name="quantitySent" required step="0.001" type="number" /></Label>
      <Label hint="(optional)" text="Note"><input className={inputClass} maxLength={500} name="note" placeholder="e.g. 40 bags of 25 kg" /></Label>
    </div>
    <FormFooter error={error} label="Send transfer" pending={pending} pendingLabel="Sending…"><Link className="inline-flex h-12 items-center px-3 font-semibold text-[#5d685e]" href="/dashboard/manufacturer/transfers">Cancel</Link></FormFooter>
  </FormCard>;
}
