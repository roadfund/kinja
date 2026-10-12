"use client";

import { Leaf, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormFooter, inputClass } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { moneyItem, moneyLines, type MoneyContext } from "@/domain/currency";
import { minorToInput, toMinor } from "@/domain/money";
import type { CropSetupRow } from "@/admin/hub-crop-setup";

type GradeDraft = { key: string; gradeId?: string; name: string; price: string };
const draftsFrom = (crop: CropSetupRow): GradeDraft[] => crop.grades.map((grade) => ({ key: grade.gradeId, gradeId: grade.gradeId, name: grade.name, price: minorToInput(grade.priceMinorPerKg) }));
const DEFAULT_GRADES: GradeDraft[] = [{ key: "a", name: "Grade A", price: "" }, { key: "b", name: "Grade B", price: "" }, { key: "r", name: "Rejected", price: "0.00" }];

// One editor per master crop: switch it on, then set each grade and its price per kg.
export function CropSetupCard({ crop, currency, money }: { crop: CropSetupRow; currency: string; money: MoneyContext }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [enabled, setEnabled] = useState(crop.enabled);
  const [grades, setGrades] = useState<GradeDraft[]>(crop.grades.length ? draftsFrom(crop) : DEFAULT_GRADES);
  const [saved, setSaved] = useState(false);
  const update = (key: string, changes: Partial<GradeDraft>) => { setSaved(false); setGrades((current) => current.map((grade) => (grade.key === key ? { ...grade, ...changes } : grade))); };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const result = await run<{ grades: CropSetupRow["grades"] }>("/admin/crops/save", { cropId: crop.cropId, enabled, grades: grades.map((grade) => ({ gradeId: grade.gradeId, name: grade.name.trim(), priceMinorPerKg: toMinor(grade.price || "0") })) });
    if (result) {
      setGrades(result.grades.map((grade) => ({ key: grade.gradeId, gradeId: grade.gradeId, name: grade.name, price: minorToInput(grade.priceMinorPerKg) })));
      setSaved(true);
      router.refresh();
    }
  }

  return <form className={`rounded-2xl border bg-white p-5 sm:p-6 ${enabled ? "border-[#cbded0]" : "border-[#dce2d9]"}`} onSubmit={submit}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${enabled ? "bg-[#e7eee4] text-[var(--kinja-green)]" : "bg-[#eef1eb] text-[#9aa69c]"}`}><Leaf size={19} aria-hidden="true" /></span><div><h2 className="font-semibold text-[var(--kinja-green)]">{crop.name}</h2><p className="text-sm text-[#718074]">{enabled ? "Enabled for farmers and deliveries" : "Not enabled"}</p></div></div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-[#344e41]"><input checked={enabled} className="h-5 w-5 accent-[var(--kinja-green)]" onChange={(event) => { setEnabled(event.target.checked); setSaved(false); }} type="checkbox" />Enabled</label>
    </div>
    <div className="mt-5 space-y-3">
      <div className="hidden grid-cols-[1fr_12rem_2.75rem] gap-3 text-xs font-medium uppercase tracking-[0.12em] text-[#718074] sm:grid"><span>Grade</span><span>Price per kg ({currency})</span><span /></div>
      {grades.map((grade) => {
        const locked = grade.gradeId !== undefined && crop.usedGradeIds.includes(grade.gradeId);
        return <div className="grid grid-cols-[1fr_9rem_2.75rem] gap-3 sm:grid-cols-[1fr_12rem_2.75rem]" key={grade.key}>
          <input aria-label="Grade name" className={`${inputClass} mt-0`} maxLength={40} onChange={(event) => update(grade.key, { name: event.target.value })} placeholder="e.g. Grade A" required value={grade.name} />
          <span><input aria-label={`Price per kg in ${currency}`} className={`${inputClass} mt-0`} inputMode="decimal" min="0" onChange={(event) => update(grade.key, { price: event.target.value })} placeholder="0.00" required step="0.01" type="number" value={grade.price} />{/^\d+(\.\d{1,2})?$/.test(grade.price) && money.currencies.length > 1 && <span className="mt-1 block text-xs text-[#718074]">≈ {moneyLines(money, moneyItem(toMinor(grade.price), currency)).slice(1).map((line) => line.text).join(" · ")}</span>}</span>
          <button aria-label={locked ? "Used by deliveries, cannot be removed" : `Remove ${grade.name || "grade"}`} className="flex h-12 items-center justify-center rounded-xl border border-[#cbd2c9] text-[#b42318] disabled:cursor-not-allowed disabled:text-[#cbd2c9]" disabled={locked || grades.length === 1} onClick={() => { setSaved(false); setGrades((current) => current.filter((item) => item.key !== grade.key)); }} title={locked ? "Used by recorded deliveries" : "Remove grade"} type="button"><Trash2 size={16} aria-hidden="true" /></button>
        </div>;
      })}
      {grades.length < 10 && <button className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--kinja-green)]" onClick={() => { setSaved(false); setGrades((current) => [...current, { key: `new-${Date.now()}`, name: "", price: "" }]); }} type="button"><Plus size={16} aria-hidden="true" />Add grade</button>}
    </div>
    <div className="mt-4"><FormFooter error={error} label="Save" pending={pending} pendingLabel="Saving…" success={saved ? "Saved. New deliveries use these prices." : undefined} /></div>
  </form>;
}
