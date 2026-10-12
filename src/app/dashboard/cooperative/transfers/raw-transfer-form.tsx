"use client";

import { Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { formatQuantity, fromThousandths, toThousandths } from "@/domain/money";

export type SendableDelivery = { id: string; cropId: string; farmerName: string; date: string; kilograms: string; gradeName: string };

export function RawTransferForm({ manufacturers, crops, deliveries }: { manufacturers: Array<{ id: string; name: string }>; crops: Array<{ id: string; name: string }>; deliveries: SendableDelivery[] }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [cropId, setCropId] = useState(crops[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("");
  const available = deliveries.filter((delivery) => delivery.cropId === cropId);
  const selectedTotal = useMemo(() => available.filter((delivery) => selected.includes(delivery.id)).reduce((sum, delivery) => sum + toThousandths(delivery.kilograms), 0), [available, selected]);

  function toggle(id: string, checked: boolean) {
    const next = checked ? [...selected, id] : selected.filter((item) => item !== id);
    setSelected(next);
    setQuantity(fromThousandths(available.filter((delivery) => next.includes(delivery.id)).reduce((sum, delivery) => sum + toThousandths(delivery.kilograms), 0)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (await run("/manufacture/transfers/raw", { toOrganizationId: data.get("toOrganizationId"), cropId, deliveryIds: selected, quantitySent: quantity.trim(), note: data.get("note") })) {
      router.push("/dashboard/cooperative/transfers");
      router.refresh();
    }
  }

  return <FormCard description="Link the deliveries this raw material came from, so every product can be traced back to farmers." icon={<Truck size={20} aria-hidden="true" />} onSubmit={submit} title="Send raw material">
    <div className="grid gap-5 sm:grid-cols-2">
      <Label required text="Manufacturer"><select className={inputClass} name="toOrganizationId" required><option value="">Select a manufacturer</option>{manufacturers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Label>
      <Label required text="Crop"><select className={inputClass} onChange={(event) => { setCropId(event.target.value); setSelected([]); setQuantity(""); }} required value={cropId}>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}</select></Label>
    </div>
    <fieldset>
      <legend className="text-sm font-medium text-[#344e41]">Deliveries included <span className="text-[#b42318]">*</span> <span className="font-normal text-[#718074]">({selected.length} selected, {formatQuantity(selectedTotal, "KG")})</span></legend>
      {available.length === 0 ? <p className="mt-2 rounded-xl bg-[#f7f9f5] p-4 text-sm text-[#5d685e]">No unsent deliveries of this crop. <Link className="font-semibold text-[var(--kinja-green)] underline" href="/dashboard/cooperative/deliveries/new">Record a delivery</Link></p> :
        <div className="mt-2 max-h-80 divide-y divide-[#eef1eb] overflow-y-auto rounded-xl border border-[#dce2d9]">{available.map((delivery) => <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-sm" key={delivery.id}><input checked={selected.includes(delivery.id)} className="h-5 w-5 accent-[var(--kinja-green)]" onChange={(event) => toggle(delivery.id, event.target.checked)} type="checkbox" /><span className="flex-1 font-medium text-[#344e41]">{delivery.farmerName}</span><span className="text-[#718074]">{delivery.date}</span><span className="w-20 text-[#5d685e]">{delivery.gradeName}</span><span className="w-20 text-right text-[#344e41]">{formatQuantity(toThousandths(delivery.kilograms), "KG")}</span></label>)}</div>}
    </fieldset>
    <div className="grid gap-5 sm:grid-cols-2">
      <Label hint="(defaults to the deliveries' total)" required text="Kg sent"><input className={inputClass} inputMode="decimal" min="0.001" onChange={(event) => setQuantity(event.target.value)} required step="0.001" type="number" value={quantity} /></Label>
      <Label hint="(optional)" text="Note"><input className={inputClass} maxLength={500} name="note" placeholder="e.g. Truck LR-1234" /></Label>
    </div>
    <FormFooter error={error || (selected.length === 0 && quantity ? "Select at least one delivery." : "")} label="Send transfer" pending={pending} pendingLabel="Sending…"><Link className="inline-flex h-12 items-center px-3 font-semibold text-[#5d685e]" href="/dashboard/cooperative/transfers">Cancel</Link></FormFooter>
  </FormCard>;
}
