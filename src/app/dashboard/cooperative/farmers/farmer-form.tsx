"use client";

import { Check, ChevronLeft, ChevronRight, LoaderCircle, LocateFixed, MapPin, Phone, Plus, Sprout, Trash2, UserPlus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { SuccessDialog } from "@/components/success-dialog";
import { PhotoField } from "@/components/photo-field";
import type { Farmer } from "@/domain/model";
import { createUuidV7 } from "@/domain/id";
import { readOfflinePack, submitFieldWrite } from "@/field/offline/field-sync";

const statuses = [["ALREADY_GROWS", "Already grows"], ["CURRENTLY_GROWING", "Currently growing"], ["WANTS_TO_GROW", "Wants to grow"]];
const incomeSources = ["Farming only", "Farming plus trade", "Farming plus wage work", "Other"];
type Plot = { id: number; recordId?: string; description: string; village: string; size: string; unit: string; tenure: string; crops: string[]; otherCrop: string; gps: string; gpsStatus: "idle" | "locating" | "error" };
const newPlot = (id: number): Plot => ({ id, recordId: createUuidV7(), description: "", village: "", size: "", unit: "ACRES", tenure: "OWNED", crops: [], otherCrop: "", gps: "", gpsStatus: "idle" });
const plotFromRecord = (plot: Farmer["plots"][number], index: number): Plot => ({ ...newPlot(index + 1), recordId: plot.id, description: plot.description, village: plot.village, size: String(plot.size), unit: plot.unit, tenure: plot.tenure, crops: plot.crops, otherCrop: plot.otherCrop ?? "", gps: plot.gps ?? "" });
const inputClass = "mt-2 h-12 w-full rounded-xl border border-[#cbd2c9] bg-white px-4 outline-none placeholder:text-[#9aa69c] focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10";

function TextField({ label, name, placeholder, icon: Icon, type = "text", required = false, value, defaultValue, onChange, onBlur, readOnly = false }: { label: string; name: string; placeholder: string; icon: typeof UserPlus; type?: string; required?: boolean; value?: string; defaultValue?: string; onChange?: (value: string) => void; onBlur?: (value: string) => void; readOnly?: boolean }) {
  return <label className="block text-sm font-medium text-[#344e41]">{label}{required && <span className="text-[#b42318]"> *</span>}<span className="relative mt-2 block"><Icon aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718074]" size={18} /><input className={`${inputClass} pl-11 ${readOnly ? "bg-[#f7f9f5] text-[#718074]" : ""}`} name={name} placeholder={placeholder} required={required} readOnly={readOnly} type={type} value={value} defaultValue={defaultValue} onChange={onChange && ((event) => onChange(event.target.value))} onBlur={onBlur && ((event) => onBlur(event.target.value))} /></span></label>;
}

function SelectField({ label, name, children, required = false, defaultValue }: { label: string; name: string; children: React.ReactNode; required?: boolean; defaultValue?: string }) {
  return <label className="block text-sm font-medium text-[#344e41]">{label}{required && <span className="text-[#b42318]"> *</span>}<select className={`${inputClass} bg-white`} defaultValue={defaultValue} name={name} required={required}>{children}</select></label>;
}

const optionalNumber = (value: FormDataEntryValue | null) => (value ? Number(value) : undefined);

function farmerPayload(data: FormData, plots: Plot[]) {
  const text = (name: string) => String(data.get(name) ?? "").trim();
  return {
    fullName: text("fullName"),
    gender: text("gender"),
    dateOfBirth: text("dateOfBirth") || undefined,
    age: Number(text("age")),
    community: text("community"),
    phone: text("phone") || undefined,
    mobileMoneyNumber: text("mobileMoneyNumber") || undefined,
    householdSize: optionalNumber(data.get("householdSize")),
    dependents: optionalNumber(data.get("dependents")),
    headOfHousehold: text("headOfHousehold") ? text("headOfHousehold") === "YES" : undefined,
    topCrops: [1, 2, 3].filter((rank) => text(`crop${rank}`)).map((rank) => ({ crop: text(`crop${rank}`), status: text(`crop${rank}Status`) })),
    plots: plots.map((plot) => ({ id: plot.recordId, description: plot.description, village: plot.village, size: Number(plot.size), unit: plot.unit, tenure: plot.tenure, crops: plot.crops, otherCrop: plot.crops.includes("Other") ? plot.otherCrop : undefined, gps: plot.gps || undefined })),
    incomeSource: text("incomeSource"),
  };
}

function validateCropRanks(form: HTMLFormElement) {
  const ranked = new Set<string>();
  for (const rank of [1, 2, 3]) {
    const crop = form.elements.namedItem(`crop${rank}`) as HTMLSelectElement;
    const status = form.elements.namedItem(`crop${rank}Status`) as HTMLSelectElement;
    crop.setCustomValidity(crop.value && ranked.has(crop.value) ? "This crop is already ranked above." : "");
    status.setCustomValidity(crop.value && !status.value ? "Select a status for this crop." : "");
    if (crop.value) ranked.add(crop.value);
  }
}

// Registers a new farmer, or edits `farmer` when one is passed.
// Registers a new farmer, or edits `farmer`. Saves go through the device sync queue, so this works offline.
export function FarmerForm({ crops, farmer, userId }: { crops: string[]; farmer?: Farmer; userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [birthDate, setBirthDate] = useState(farmer?.dateOfBirth ?? "");
  const [age, setAge] = useState(farmer ? String(farmer.age) : "");
  const [photoUrl, setPhotoUrl] = useState(farmer?.photoUrl ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const [outcome, setOutcome] = useState<{ title: string; description: string } | null>(null);
  const [phoneWarning, setPhoneWarning] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [plots, setPlots] = useState<Plot[]>(farmer ? farmer.plots.map(plotFromRecord) : [newPlot(1)]);
  const topCrop = (rank: number) => farmer?.topCrops[rank - 1];
  const incomeOptions = farmer && !incomeSources.includes(farmer.incomeSource) ? [...incomeSources, farmer.incomeSource] : incomeSources;
  const calculatedAge = useMemo(() => { if (!birthDate) return age; const birth = new Date(`${birthDate}T00:00:00`); const today = new Date(); let years = today.getFullYear() - birth.getFullYear(); if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) years -= 1; return years >= 0 ? String(years) : ""; }, [birthDate, age]);
  const updatePlot = (id: number, changes: Partial<Plot>) => setPlots((current) => current.map((plot) => plot.id === id ? { ...plot, ...changes } : plot));
  const addPlot = () => setPlots((current) => [...current, newPlot(Date.now())]);
  const removePlot = (id: number) => setPlots((current) => current.length === 1 ? current : current.filter((plot) => plot.id !== id));
  const locatePlot = (id: number) => {
    if (!navigator.geolocation) return updatePlot(id, { gpsStatus: "error" });
    updatePlot(id, { gpsStatus: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => updatePlot(id, { gps: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`, gpsStatus: "idle" }),
      () => updatePlot(id, { gpsStatus: "error" }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  const resetForm = () => { setStep(1); setBirthDate(""); setAge(""); setPhotoUrl(""); setOutcome(null); setPhoneWarning(""); setSaveError(""); setPlots([newPlot(1)]); };

  function continueToNextStep(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    if (step === 3) validateCropRanks(form);
    const fields = form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-step="${step}"] input, [data-step="${step}"] select`);
    if ([...fields].every((field) => field.reportValidity())) setStep((current) => current + 1);
  }

  // Warns (never blocks) when another farmer in the hub already has this phone.
  async function checkPhone(raw: string) {
    setPhoneWarning("");
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 7) return;
    try {
      if (navigator.onLine) {
        const response = await fetch(`/field/phone-check?phone=${encodeURIComponent(raw)}${farmer ? `&exclude=${farmer.id}` : ""}`);
        const { matches } = (await response.json()) as { matches: Array<{ fullName: string }> };
        if (matches.length) setPhoneWarning(`This phone is already used by ${matches.map((match) => match.fullName).join(", ")}. You can still save.`);
        return;
      }
      const match = readOfflinePack(userId)?.farmers.find((item) => item.id !== farmer?.id && item.phone && item.phone.replace(/\D/g, "").endsWith(digits.slice(-7)));
      if (match) setPhoneWarning(`This phone may already be used by ${match.fullName}. You can still save.`);
    } catch {
      // A warning is a convenience; never stop the form for it.
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (saving || !form.reportValidity()) return;
    setSaving(true);
    setSaveError("");
    const payload = { ...farmerPayload(new FormData(form), plots), photoUrl: photoUrl || undefined };
    const result = await submitFieldWrite(userId, { kind: farmer ? "UPDATE_FARMER" : "CREATE_FARMER", recordId: farmer?.id ?? createUuidV7(), recordedAt: new Date().toISOString(), payload, label: `${payload.fullName}${payload.community ? `, ${payload.community}` : ""}` });
    setSaving(false);
    if (result.status === "rejected") return setSaveError(result.message ?? "Could not save the farmer.");
    if (farmer && result.status === "synced") {
      router.push(`/dashboard/cooperative/farmers/${farmer.id}`);
      router.refresh();
      return;
    }
    const notes = [result.message, ...(result.warnings ?? [])].filter(Boolean).join(" ");
    setOutcome(result.status === "queued"
      ? { title: "Saved on this device", description: `You are offline. ${farmer ? "The changes" : "This farmer"} will sync automatically when you are back online.` }
      : { title: "Farmer saved", description: `The farmer record has been created for your cooperative.${notes ? ` ${notes}` : ""}` });
  }


  return (
    <form className="space-y-6" onSubmit={submit} ref={formRef}>
      <div className="rounded-2xl border border-[#dce2d9] bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-[var(--kinja-green)]">Step {step} of 5</p><p className="text-sm text-[#718074]">{["Biodata", "Family", "Crops", "Plots", "Income"][step - 1]}</p></div><div className="mt-4 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((item) => <span className={`h-1.5 rounded-full ${item <= step ? "bg-[var(--kinja-green)]" : "bg-[#e5e9e2]"}`} key={item} />)}</div></div>
      <section data-step={1} hidden={step !== 1} className="rounded-2xl border border-[#dce2d9] bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><UserPlus className="text-[var(--kinja-green)]" size={22} aria-hidden="true" /><h2 className="font-semibold text-[var(--kinja-green)]">Biodata</h2></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><TextField label="Full name" name="fullName" placeholder="e.g. Mariama Kromah" icon={UserPlus} required defaultValue={farmer?.fullName} /><SelectField label="Gender" name="gender" required defaultValue={farmer?.gender}><option value="">Select gender</option><option value="FEMALE">Female</option><option value="MALE">Male</option></SelectField><label className="block text-sm font-medium text-[#344e41]">Date of birth<input className={inputClass} name="dateOfBirth" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label><TextField label="Age" name="age" placeholder="e.g. 42" icon={UserPlus} type="number" required value={calculatedAge} onChange={setAge} readOnly={Boolean(birthDate)} /><TextField label="Community or village" name="community" placeholder="Community name" icon={MapPin} required defaultValue={farmer?.community} /><div><TextField label="Phone number (optional)" name="phone" placeholder="+231 77 000 0000" icon={Phone} type="tel" defaultValue={farmer?.phone} onBlur={checkPhone} />{phoneWarning && <p className="mt-1 text-xs text-[#8b6818]" role="status">{phoneWarning}</p>}</div><TextField label="Mobile money number (optional)" name="mobileMoneyNumber" placeholder="For payouts" icon={Wallet} type="tel" defaultValue={farmer?.mobileMoneyNumber} /></div><div className="mt-5"><PhotoField label="Farmer photo" name="photo" hint="(optional, JPG, PNG or WebP, max 5MB)" value={photoUrl} onChange={setPhotoUrl} /></div></section>
      <section data-step={2} hidden={step !== 2} className="rounded-2xl border border-[#dce2d9] bg-white p-6 sm:p-8"><h2 className="font-semibold text-[var(--kinja-green)]">Family data <span className="font-normal text-[#718074]">(optional)</span></h2><div className="mt-5 grid gap-5 sm:grid-cols-3"><TextField label="Household size" name="householdSize" placeholder="e.g. 6" icon={UserPlus} type="number" defaultValue={farmer?.householdSize?.toString()} /><TextField label="Number of dependents" name="dependents" placeholder="e.g. 4" icon={UserPlus} type="number" defaultValue={farmer?.dependents?.toString()} /><SelectField label="Head of household" name="headOfHousehold" defaultValue={farmer?.headOfHousehold === undefined ? "" : farmer.headOfHousehold ? "YES" : "NO"}><option value="">Select</option><option value="YES">Yes</option><option value="NO">No</option></SelectField></div></section>
      <section data-step={3} hidden={step !== 3} className="rounded-2xl border border-[#dce2d9] bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><Sprout className="text-[var(--kinja-green)]" size={21} aria-hidden="true" /><div><h2 className="font-semibold text-[var(--kinja-green)]">Top crops</h2><p className="mt-1 text-sm text-[#5d685e]">Rank up to three enabled hub crops.</p></div></div><div className="mt-5 space-y-4">{[1, 2, 3].map((rank) => <div className="grid gap-4 sm:grid-cols-3" key={rank}><p className="pt-3 text-sm font-semibold text-[#718074]">Rank {rank}</p><SelectField label="Crop" name={`crop${rank}`} required={rank === 1} defaultValue={topCrop(rank)?.crop ?? ""}><option value="">{rank === 1 ? "Select crop" : "None"}</option>{crops.map((crop) => <option key={crop}>{crop}</option>)}</SelectField><SelectField label="Status" name={`crop${rank}Status`} defaultValue={topCrop(rank)?.status ?? ""}><option value="">Select status</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></div>)}</div></section>
      <section data-step={4} hidden={step !== 4} className="rounded-2xl border border-[#dce2d9] bg-white p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-[var(--kinja-green)]">Farm plots</h2><p className="mt-1 text-sm text-[#5d685e]">Add at least one plot.</p></div><button className="inline-flex items-center gap-2 rounded-xl border border-[#cbd2c9] px-3 py-2 text-sm font-semibold text-[var(--kinja-green)]" onClick={addPlot} type="button"><Plus size={16} aria-hidden="true" />Add plot</button></div><div className="mt-5 space-y-5">{plots.map((plot, index) => <div className="rounded-xl border border-[#e5e9e2] p-4" key={plot.id}><div className="mb-4 flex items-center justify-between"><p className="font-semibold text-[#344e41]">Plot {index + 1}</p>{plots.length > 1 && <button className="text-[#b42318]" onClick={() => removePlot(plot.id)} type="button"><Trash2 size={16} aria-hidden="true" /></button>}</div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-[#344e41]">Name or description<input className={inputClass} placeholder="e.g. River plot" required value={plot.description} onChange={(event) => updatePlot(plot.id, { description: event.target.value })} /></label><label className="text-sm font-medium text-[#344e41]">Village or location<input className={inputClass} placeholder="Village name" required value={plot.village} onChange={(event) => updatePlot(plot.id, { village: event.target.value })} /></label><label className="text-sm font-medium text-[#344e41]">Approximate size<input className={inputClass} placeholder="e.g. 2.5" required type="number" min="0.01" step="0.01" inputMode="decimal" value={plot.size} onChange={(event) => updatePlot(plot.id, { size: event.target.value })} /></label><label className="text-sm font-medium text-[#344e41]">Unit<select className={inputClass} value={plot.unit} onChange={(event) => updatePlot(plot.id, { unit: event.target.value })}><option>ACRES</option><option>HECTARES</option></select></label><label className="text-sm font-medium text-[#344e41]">Tenure<select className={inputClass} value={plot.tenure} onChange={(event) => updatePlot(plot.id, { tenure: event.target.value })}><option>OWNED</option><option>RENTED</option><option>SHARED</option></select></label><div className="text-sm font-medium text-[#344e41]">GPS <span className="font-normal text-[#718074]">(optional)</span><button className="mt-2 flex h-12 w-full items-center gap-3 rounded-xl border border-[#cbd2c9] bg-white px-4 text-left disabled:opacity-60" disabled={plot.gpsStatus === "locating"} onClick={() => locatePlot(plot.id)} type="button">{plot.gpsStatus === "locating" ? <LoaderCircle className="animate-spin text-[var(--kinja-green)]" size={18} aria-hidden="true" /> : <LocateFixed className="text-[var(--kinja-green)]" size={18} aria-hidden="true" />}<span className={plot.gps ? "text-[#344e41]" : "text-[#718074]"}>{plot.gpsStatus === "locating" ? "Getting location…" : plot.gps || "Use current location"}</span></button>{plot.gpsStatus === "error" && <span className="mt-1 block text-xs font-normal text-[#b42318]" role="alert">Could not get location. Check location permission and try again.</span>}</div></div><div className="mt-4"><p className="text-sm font-medium text-[#344e41]">Crops grown on this plot</p><div className="mt-2 flex flex-wrap gap-3">{[...crops, "Other"].map((crop) => <label className="flex items-center gap-2 text-sm text-[#5d685e]" key={crop}><input type="checkbox" checked={plot.crops.includes(crop)} onChange={(event) => updatePlot(plot.id, { crops: event.target.checked ? [...plot.crops, crop] : plot.crops.filter((item) => item !== crop) })} />{crop}</label>)}</div>{plot.crops.includes("Other") && <input className={inputClass} placeholder="Name the other crop" required value={plot.otherCrop} onChange={(event) => updatePlot(plot.id, { otherCrop: event.target.value })} />}</div></div>)}</div></section>
      <section data-step={5} hidden={step !== 5} className="rounded-2xl border border-[#dce2d9] bg-white p-6 sm:p-8"><h2 className="font-semibold text-[var(--kinja-green)]">Income</h2><SelectField label="Main income source" name="incomeSource" required defaultValue={farmer?.incomeSource ?? ""}><option value="">Select income source</option>{incomeOptions.map((source) => <option key={source}>{source}</option>)}</SelectField><p className="mt-3 text-sm text-[#718074]">Earnings are calculated from deliveries and successful payouts.</p></section>
      <div className="flex items-center justify-between gap-4"><button className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#cbd2c9] px-5 font-semibold text-[var(--kinja-green)] disabled:invisible" disabled={step === 1 || saving} onClick={() => setStep((current) => current - 1)} type="button"><ChevronLeft size={17} aria-hidden="true" />Back</button>{step < 5 ? <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white" onClick={continueToNextStep} type="button">Continue<ChevronRight size={17} aria-hidden="true" /></button> : <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white disabled:opacity-70" disabled={saving} aria-busy={saving} type="submit">{saving ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}{saving ? "Saving…" : farmer ? "Save changes" : "Save farmer"}</button>}</div>
      {saveError && <p className="text-right text-sm text-[#b42318]" role="alert">{saveError}</p>}
      {outcome && <SuccessDialog title={outcome.title} description={outcome.description} againLabel={farmer ? "Keep editing" : "Add Farmer"} onAgain={() => { if (farmer) { setOutcome(null); return; } formRef.current?.reset(); resetForm(); }} backHref={farmer ? `/dashboard/cooperative/farmers/${farmer.id}` : "/dashboard/cooperative/farmers"} />}
    </form>
  );
}
