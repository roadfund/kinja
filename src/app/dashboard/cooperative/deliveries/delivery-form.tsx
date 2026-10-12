"use client";

import { Check, ClipboardPlus, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createUuidV7 } from "@/domain/id";
import { listQueue, readOfflinePack, submitFieldWrite, QUEUE_EVENT } from "@/field/offline/field-sync";
import { SuccessDialog } from "@/components/success-dialog";
import { Money } from "@/components/kinja/money";
import { formatDual, moneyItem, type MoneyContext } from "@/domain/currency";
import { amountForWeight } from "@/domain/money";
import type { CropOption } from "@/field/deliveries";

export type FarmerOption = { id: string; name: string; plots: Array<{ id: string; description: string }> };

const inputClass = "mt-2 h-12 w-full rounded-xl border border-[#cbd2c9] bg-white px-4 outline-none focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10";
const labelClass = "block text-sm font-medium text-[#344e41]";
const WEIGHT_PATTERN = /^\d+(\.\d{1,3})?$/;

// Merges farmers from the page, the device cache, and farmers registered offline
// that have not synced yet, so deliveries can be recorded for them straight away.
function useFarmerOptions(serverFarmers: FarmerOption[], userId: string): FarmerOption[] {
  const [extra, setExtra] = useState<FarmerOption[]>([]);
  useEffect(() => {
    const read = () => {
      const cached = readOfflinePack(userId)?.farmers.map((farmer) => ({ id: farmer.id, name: farmer.fullName, plots: farmer.plots })) ?? [];
      const queued = listQueue(userId).filter((item) => item.kind === "CREATE_FARMER").map((item) => {
        const payload = item.payload as { fullName: string; plots: Array<{ id?: string; description: string }> };
        return { id: item.recordId, name: `${payload.fullName} (not synced yet)`, plots: payload.plots.flatMap((plot) => (plot.id ? [{ id: plot.id, description: plot.description }] : [])) };
      });
      setExtra([...cached, ...queued]);
    };
    const timer = window.setTimeout(read, 0);
    window.addEventListener(QUEUE_EVENT, read);
    return () => { window.clearTimeout(timer); window.removeEventListener(QUEUE_EVENT, read); };
  }, [userId]);
  const known = new Set(serverFarmers.map((farmer) => farmer.id));
  return [...serverFarmers, ...extra.filter((farmer) => !known.has(farmer.id) && (known.add(farmer.id), true))].sort((a, b) => a.name.localeCompare(b.name));
}

export function DeliveryForm({ farmers: serverFarmers, crops, userId, money }: { farmers: FarmerOption[]; crops: CropOption[]; userId: string; money: MoneyContext }) {
  const farmers = useFarmerOptions(serverFarmers, userId);
  const [farmerId, setFarmerId] = useState("");
  const [cropId, setCropId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [kilograms, setKilograms] = useState("");
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<{ title: string; description: string } | null>(null);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const farmer = farmers.find((item) => item.id === farmerId);
  const crop = crops.find((item) => item.cropId === cropId);
  const grade = crop?.grades.find((item) => item.gradeId === gradeId);
  const amount = grade && WEIGHT_PATTERN.test(kilograms) ? amountForWeight(kilograms, grade.priceMinorPerKg) : null;
  const rejected = grade?.priceMinorPerKg === 0;

  function reset() {
    formRef.current?.reset();
    setFarmerId(""); setCropId(""); setGradeId(""); setKilograms(""); setOutcome(null); setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (saving || !form.reportValidity() || !grade || !crop) return;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    // The price shown on this device is the snapshot, even if prices change before it syncs.
    const result = await submitFieldWrite(userId, { kind: "RECORD_DELIVERY", recordId: createUuidV7(), recordedAt: new Date().toISOString(), devicePriceMinorPerKg: grade.priceMinorPerKg, payload: { farmerId, plotId: String(data.get("plotId") ?? "") || undefined, cropId, gradeId, kilograms: kilograms.trim(), rejectionReason: String(data.get("rejectionReason") ?? "").trim() || undefined }, label: `${kilograms} kg ${crop.name} from ${farmer?.name.replace(" (not synced yet)", "") ?? "farmer"}` });
    setSaving(false);
    if (result.status === "rejected") return setError(result.message ?? "Could not save the delivery.");
    setOutcome(result.status === "queued" ? { title: "Saved on this device", description: "You are offline. The delivery will sync automatically when you are back online." } : { title: "Delivery saved", description: "The delivery and the amount owed have been recorded." });
  }


  return <form className="space-y-5 rounded-2xl border border-[#dce2d9] bg-white p-6 sm:p-8" onSubmit={submit} ref={formRef}>
    <div className="flex items-center gap-3"><ClipboardPlus className="text-[var(--kinja-green)]" size={22} aria-hidden="true" /><p className="font-semibold text-[var(--kinja-green)]">Delivery details</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      {farmers.length === 0 && <p className="sm:col-span-2 rounded-xl bg-[#f7f9f5] p-4 text-sm text-[#5d685e]">No farmers yet. <Link className="font-semibold text-[var(--kinja-green)] underline" href="/dashboard/cooperative/farmers/new">Register a farmer</Link> first; it works offline too.</p>}<label className={labelClass}>Farmer <span className="text-[#b42318]">*</span><select className={inputClass} required value={farmerId} onChange={(event) => setFarmerId(event.target.value)}><option value="">Select a farmer</option>{farmers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className={labelClass}>Plot <span className="font-normal text-[#718074]">(optional)</span><select className={inputClass} disabled={!farmer} key={farmerId} name="plotId"><option value="">{farmer ? "Select a plot" : "Select a farmer first"}</option>{farmer?.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.description}</option>)}</select></label>
      <label className={labelClass}>Crop <span className="text-[#b42318]">*</span><select className={inputClass} required value={cropId} onChange={(event) => { setCropId(event.target.value); setGradeId(""); }}><option value="">Select a crop</option>{crops.map((item) => <option key={item.cropId} value={item.cropId}>{item.name}</option>)}</select></label>
      <label className={labelClass}>Grade <span className="text-[#b42318]">*</span><select className={inputClass} disabled={!crop} required value={gradeId} onChange={(event) => setGradeId(event.target.value)}><option value="">{crop ? "Select a grade" : "Select a crop first"}</option>{crop?.grades.map((item) => <option key={item.gradeId} value={item.gradeId}>{item.name} · {formatDual(money, moneyItem(item.priceMinorPerKg, item.currency))}/kg</option>)}</select></label>
      <label className={labelClass}>Weight in kg <span className="text-[#b42318]">*</span><input className={inputClass} inputMode="decimal" min="0.001" placeholder="e.g. 25.5" required step="0.001" type="number" value={kilograms} onChange={(event) => setKilograms(event.target.value)} /></label>
      <div className="rounded-xl bg-[#f7f9f5] p-4"><p className="text-sm text-[#718074]">Amount owed to farmer</p><p className="mt-1 text-2xl font-semibold text-[var(--kinja-green)]">{amount === null || !crop ? "—" : <Money context={money} value={moneyItem(amount, crop.currency)} />}</p><p className="mt-1 text-xs text-[#718074]">Uses today&apos;s hub price for the grade.</p></div>
    </div>
    {rejected && <label className={labelClass}>Rejection reason <span className="text-[#b42318]">*</span><input className={inputClass} name="rejectionReason" placeholder="e.g. Rotten tubers" required /></label>}
    <div className="flex flex-wrap items-center justify-end gap-4">
      {error && <p className="text-sm text-[#b42318]" role="alert">{error}</p>}
      <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white disabled:opacity-70" aria-busy={saving} disabled={saving} type="submit">{saving ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}{saving ? "Saving delivery…" : "Save delivery"}</button>
    </div>
    {outcome && <SuccessDialog title={outcome.title} description={outcome.description} againLabel="Record another" onAgain={reset} backHref="/dashboard/cooperative/deliveries" />}
  </form>;
}
