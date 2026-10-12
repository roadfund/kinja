"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Leaf, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass } from "@/components/kinja/form";
import { RowMenu, RowMenuItem } from "@/components/kinja/row-menu";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatIn, moneyItem, type MoneyContext } from "@/domain/currency";
import { minorToInput, toMinor } from "@/domain/money";
import type { CropSaveResult, CropSetupRow } from "@/admin/hub-crop-setup";

type GradeDraft = { key: string; gradeId?: string; name: string; price: string };
type Grades = CropSetupRow["grades"];
const draftsFrom = (grades: Grades): GradeDraft[] => grades.map((grade) => ({ key: grade.gradeId, gradeId: grade.gradeId, name: grade.name, price: minorToInput(grade.priceMinorPerKg) }));
const DEFAULT_GRADES: GradeDraft[] = [{ key: "a", name: "Grade A", price: "" }, { key: "b", name: "Grade B", price: "" }, { key: "r", name: "Rejected", price: "0.00" }];

type Editing = { crop: CropSetupRow; mode: "add" | "edit" };

// The hub's crops: one card per crop the hub has added, showing its grades and prices, with
// Edit and Delete in its "⋯" menu. "Add crop" lists the rest of the Kinja crop list; picking
// one opens a window for its grades and prices, and Save adds it straight away.
export function CropSetupBoard({ crops, currency, money }: { crops: CropSetupRow[]; currency: string; money: MoneyContext }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, { enabled: boolean; grades: Grades }>>(() => Object.fromEntries(crops.map((crop) => [crop.cropId, { enabled: crop.enabled, grades: crop.grades }])));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<CropSetupRow | null>(null);
  const [notice, setNotice] = useState("");
  const added = crops.filter((crop) => state[crop.cropId].enabled);
  const available = crops.filter((crop) => !state[crop.cropId].enabled);
  const others = money.currencies.filter((code) => code !== currency);

  function applied(results: CropSaveResult[], message: string) {
    setState((current) => ({ ...current, ...Object.fromEntries(results.map((result) => [result.cropId, { enabled: result.enabled!, grades: result.grades! }])) }));
    setNotice(message);
    router.refresh();
  }

  return <>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-[var(--kinja-green)]">Your crops</h2><p className="mt-1 text-sm text-[#5d685e]">{added.length ? `${added.length} ${added.length === 1 ? "crop" : "crops"} your farmers and deliveries can use.` : "No crops yet. Add the crops your hub buys from farmers."}</p></div>
      <AddCropMenu crops={available} onPick={(crop) => { setNotice(""); setEditing({ crop, mode: "add" }); }} />
    </div>
    {notice && <p className="mt-4 flex items-center gap-2 rounded-xl border border-[#cce8d5] bg-[#f1fbf3] px-4 py-3 text-sm font-medium text-[#1f6b45]" role="status"><Check size={16} aria-hidden="true" />{notice}</p>}

    {added.length === 0 ? <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 px-6 py-12 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e7eee4] text-[var(--kinja-green)]"><Leaf size={22} aria-hidden="true" /></span><p className="mt-4 font-semibold text-[var(--kinja-green)]">Add your first crop</p><p className="mt-1 max-w-md text-sm text-[#5d685e]">Choose a crop, set its grades and price per kg, and save. Farmers can be registered as soon as one crop is set up.</p></div>
      : <div className="mt-5 grid gap-4 xl:grid-cols-2">{added.map((crop) => {
        const grades = state[crop.cropId].grades;
        return <section className="rounded-2xl border border-[#cbded0] bg-white p-5 sm:p-6" key={crop.cropId}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7eee4] text-[var(--kinja-green)]"><Leaf size={19} aria-hidden="true" /></span><div><h3 className="font-semibold text-[var(--kinja-green)]">{crop.name}</h3><p className="text-sm text-[#718074]">{grades.length} {grades.length === 1 ? "grade" : "grades"}</p></div></div>
            <RowMenu label={`Actions for ${crop.name}`}>
              <RowMenuItem icon={<Pencil size={15} aria-hidden="true" />} onClick={() => { setNotice(""); setEditing({ crop, mode: "edit" }); }}>Edit grades and prices</RowMenuItem>
              <RowMenuItem icon={<Trash2 size={15} aria-hidden="true" />} onClick={() => { setNotice(""); setDeleting(crop); }} tone="danger">Delete</RowMenuItem>
            </RowMenu>
          </div>
          {/* One value per column: the grade, then its price in each currency. */}
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-[0.12em] text-[#718074]"><th className="py-2 font-medium">Grade</th><th className="py-2 text-right font-medium">Per kg ({currency})</th>{others.map((code) => <th className="py-2 text-right font-medium" key={code}>Per kg ({code})</th>)}</tr></thead>
            <tbody className="divide-y divide-[#eef1eb]">{grades.map((grade) => <tr key={grade.gradeId}><td className="py-2.5 font-medium text-[#344e41]">{grade.name}</td><td className="py-2.5 text-right tabular-nums text-[#344e41]">{formatIn(money, [moneyItem(grade.priceMinorPerKg, currency)], currency)}</td>{others.map((code) => <td className="py-2.5 text-right tabular-nums text-[#718074]" key={code}>{formatIn(money, [moneyItem(grade.priceMinorPerKg, currency)], code)}</td>)}</tr>)}</tbody>
          </table>
        </section>;
      })}</div>}

    {editing && <CropDialog crop={editing.crop} currency={currency} grades={state[editing.crop.cropId].grades} mode={editing.mode} money={money} onClose={() => setEditing(null)} onSaved={(results) => { applied(results, editing.mode === "add" ? `${editing.crop.name} added. Farmers and deliveries can use it now.` : `${editing.crop.name} saved. New deliveries use these prices.`); setEditing(null); }} />}
    {deleting && <DeleteCropDialog crop={deleting} grades={state[deleting.cropId].grades} onClose={() => setDeleting(null)} onDeleted={(results) => { applied(results, `${deleting.name} removed from your hub. Past deliveries keep it.`); setDeleting(null); }} />}
  </>;
}

function AddCropMenu({ crops, onPick }: { crops: CropSetupRow[]; onPick: (crop: CropSetupRow) => void }) {
  return <Menu.Root>
    <Menu.Trigger className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white disabled:opacity-50" disabled={crops.length === 0} title={crops.length === 0 ? "Every crop on the Kinja list is already added" : undefined}><Plus size={17} aria-hidden="true" />Add crop<ChevronDown className="opacity-80" size={16} aria-hidden="true" /></Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner align="end" className="z-50 outline-none" sideOffset={6}>
        <Menu.Popup className="max-h-[60vh] min-w-56 overflow-y-auto rounded-xl border border-[#dce2d9] bg-white p-1.5 shadow-lg shadow-black/5 outline-none">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#718074]">Kinja crop list</p>
          {crops.map((crop) => <Menu.Item className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-[#344e41] outline-none data-[highlighted]:bg-[#f0f4ed]" key={crop.cropId} onClick={() => onPick(crop)}><Leaf className="text-[#718074]" size={15} aria-hidden="true" />{crop.name}{crop.grades.length > 0 && <span className="ml-auto text-xs font-normal text-[#9aa69c]">used before</span>}</Menu.Item>)}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}

// Add a crop, or edit one: its grades and price per kg. Save applies at once.
function CropDialog({ crop, grades, mode, currency, money, onClose, onSaved }: { crop: CropSetupRow; grades: Grades; mode: "add" | "edit"; currency: string; money: MoneyContext; onClose: () => void; onSaved: (results: CropSaveResult[]) => void }) {
  const { run, pending, error, setError } = useJsonAction();
  const [drafts, setDrafts] = useState<GradeDraft[]>(grades.length ? draftsFrom(grades) : DEFAULT_GRADES);
  const update = (key: string, changes: Partial<GradeDraft>) => { setError(""); setDrafts((current) => current.map((grade) => (grade.key === key ? { ...grade, ...changes } : grade))); };
  const others = money.currencies.filter((code) => code !== currency);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await run<{ results: CropSaveResult[] }>("/admin/crops/save", { crops: [{ cropId: crop.cropId, enabled: true, grades: drafts.map((grade) => ({ gradeId: grade.gradeId, name: grade.name.trim(), priceMinorPerKg: toMinor(grade.price || "0") })) }] });
    if (!response) return;
    const failed = response.results.find((result) => result.error);
    if (failed) return setError(failed.error!);
    onSaved(response.results);
  }

  return <Dialog onOpenChange={(open) => { if (!open) onClose(); }} open>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <form className="grid gap-4" onSubmit={submit}>
        <DialogHeader><DialogTitle>{mode === "add" ? `Add ${crop.name}` : `Edit ${crop.name}`}</DialogTitle><DialogDescription>The grades your hub buys {crop.name.toLowerCase()} in, and the price per kg for each. New deliveries are priced from these; past deliveries keep their price.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_10rem_2.75rem] gap-3 text-xs font-medium uppercase tracking-[0.12em] text-[#718074] sm:grid"><span>Grade</span><span>Per kg ({currency})</span><span /></div>
          {drafts.map((grade) => {
            const locked = grade.gradeId !== undefined && crop.usedGradeIds.includes(grade.gradeId);
            return <div className="grid grid-cols-[1fr_8rem_2.75rem] gap-3 sm:grid-cols-[1fr_10rem_2.75rem]" key={grade.key}>
              <input aria-label="Grade name" className={`${inputClass} mt-0`} maxLength={40} onChange={(event) => update(grade.key, { name: event.target.value })} placeholder="e.g. Grade A" required value={grade.name} />
              <span><input aria-label={`Price per kg in ${currency}`} className={`${inputClass} mt-0`} inputMode="decimal" min="0" onChange={(event) => update(grade.key, { price: event.target.value })} placeholder="0.00" required step="0.01" type="number" value={grade.price} />{others.length > 0 && /^\d+(\.\d{1,2})?$/.test(grade.price) && <span className="mt-1 block text-xs text-[#718074]">≈ {others.map((code) => formatIn(money, [moneyItem(toMinor(grade.price), currency)], code)).join(" · ")}</span>}</span>
              <button aria-label={locked ? "Used by deliveries, cannot be removed" : `Remove ${grade.name || "grade"}`} className="flex h-12 items-center justify-center rounded-xl border border-[#cbd2c9] text-[#b42318] disabled:cursor-not-allowed disabled:text-[#cbd2c9]" disabled={locked || drafts.length === 1} onClick={() => setDrafts((current) => current.filter((item) => item.key !== grade.key))} title={locked ? "Used by recorded deliveries" : "Remove grade"} type="button"><Trash2 size={16} aria-hidden="true" /></button>
            </div>;
          })}
          {drafts.length < 10 && <button className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--kinja-green)]" onClick={() => setDrafts((current) => [...current, { key: `new-${Date.now()}`, name: "", price: "" }])} type="button"><Plus size={16} aria-hidden="true" />Add grade</button>}
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button disabled={pending} type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{mode === "add" ? `Add ${crop.name}` : "Save changes"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

// Removing a crop switches it off for the hub. Past deliveries keep their crop and prices,
// and adding it again later brings its grades back.
function DeleteCropDialog({ crop, grades, onClose, onDeleted }: { crop: CropSetupRow; grades: Grades; onClose: () => void; onDeleted: (results: CropSaveResult[]) => void }) {
  const { run, pending, error, setError } = useJsonAction();
  async function confirm() {
    const response = await run<{ results: CropSaveResult[] }>("/admin/crops/save", { crops: [{ cropId: crop.cropId, enabled: false, grades: grades.map((grade) => ({ gradeId: grade.gradeId, name: grade.name, priceMinorPerKg: grade.priceMinorPerKg })) }] });
    if (!response) return;
    const failed = response.results.find((result) => result.error);
    if (failed) return setError(failed.error!);
    onDeleted(response.results);
  }
  return <Dialog onOpenChange={(open) => { if (!open) onClose(); }} open>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Delete {crop.name}?</DialogTitle><DialogDescription>Farmers and deliveries can no longer use {crop.name.toLowerCase()}. Deliveries already recorded keep it and their prices, and you can add it again later.</DialogDescription></DialogHeader>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <DialogFooter>
        <DialogClose render={<Button disabled={pending} type="button" variant="outline" />}>Cancel</DialogClose>
        <Button disabled={pending} onClick={confirm} type="button" variant="destructive">{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Delete {crop.name}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
