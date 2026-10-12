"use client";

import { Factory } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { formatQuantity, toThousandths } from "@/domain/money";

const NEW_PRODUCT = "__new__";
type RawMaterial = { id: string; label: string; receivedKg: string };

export function BatchForm({ products, rawMaterial }: { products: Array<{ id: string; name: string; unit: "KG" | "UNIT" }>; rawMaterial: RawMaterial[] }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [productId, setProductId] = useState(products[0]?.id ?? NEW_PRODUCT);
  const [newUnit, setNewUnit] = useState<"KG" | "UNIT">("KG");
  const [selected, setSelected] = useState<string[]>([]);
  const [produced, setProduced] = useState("");
  const unit = productId === NEW_PRODUCT ? newUnit : products.find((product) => product.id === productId)?.unit ?? "KG";
  const inputThousandths = rawMaterial.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + toThousandths(item.receivedKg), 0);
  const producedNumber = Number(produced);
  const preview = inputThousandths && producedNumber > 0 ? (unit === "KG" ? `${((producedNumber * 1000 / inputThousandths) * 100).toFixed(1)}% yield` : `${(producedNumber * 1000 / inputThousandths).toFixed(2)} units per kg`) : "—";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const product = productId === NEW_PRODUCT ? { newProductName: data.get("newProductName"), newProductUnit: newUnit } : { productId };
    if (await run("/manufacture/batches", { ...product, transferIds: selected, quantityProduced: produced.trim(), wastageKg: String(data.get("wastageKg") ?? "0").trim() || "0" })) {
      router.push("/dashboard/manufacturer/batches");
      router.refresh();
    }
  }

  return <FormCard description="Select the raw material that went in, then record what came out and what was wasted." icon={<Factory size={20} aria-hidden="true" />} onSubmit={submit} title="New production batch">
    <div className="grid gap-5 sm:grid-cols-2">
      <Label required text="Product"><select className={inputClass} onChange={(event) => setProductId(event.target.value)} value={productId}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.unit === "KG" ? "kg" : "units"})</option>)}<option value={NEW_PRODUCT}>+ New product</option></select></Label>
      {productId === NEW_PRODUCT && <div className="grid grid-cols-[2fr_1fr] gap-3"><Label required text="Product name"><input className={inputClass} maxLength={80} minLength={2} name="newProductName" placeholder="e.g. Gari" required /></Label><Label required text="Measured in"><select className={inputClass} onChange={(event) => setNewUnit(event.target.value as "KG" | "UNIT")} value={newUnit}><option value="KG">kg</option><option value="UNIT">units</option></select></Label></div>}
    </div>
    <fieldset>
      <legend className="text-sm font-medium text-[#344e41]">Raw material used <span className="text-[#b42318]">*</span> <span className="font-normal text-[#718074]">({formatQuantity(inputThousandths, "KG")} selected)</span></legend>
      {rawMaterial.length === 0 ? <p className="mt-2 rounded-xl bg-[#f7f9f5] p-4 text-sm text-[#5d685e]">No received raw material is waiting to be used. <Link className="font-semibold text-[var(--kinja-green)] underline" href="/dashboard/manufacturer/transfers">Confirm incoming transfers</Link> first.</p> :
        <div className="mt-2 divide-y divide-[#eef1eb] rounded-xl border border-[#dce2d9]">{rawMaterial.map((item) => <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-sm" key={item.id}><input checked={selected.includes(item.id)} className="h-5 w-5 accent-[var(--kinja-green)]" onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} type="checkbox" /><span className="flex-1 text-[#344e41]">{item.label}</span><span className="text-[#344e41]">{formatQuantity(toThousandths(item.receivedKg), "KG")}</span></label>)}</div>}
    </fieldset>
    <div className="grid gap-5 sm:grid-cols-3">
      <Label required text={`Quantity produced (${unit === "KG" ? "kg" : "units"})`}><input className={inputClass} inputMode="decimal" min="0.001" onChange={(event) => setProduced(event.target.value)} required step="0.001" type="number" value={produced} /></Label>
      <Label required text="Wastage (kg)"><input className={inputClass} defaultValue="0" inputMode="decimal" min="0" name="wastageKg" required step="0.001" type="number" /></Label>
      <div className="rounded-xl bg-[#f7f9f5] p-4"><p className="text-sm text-[#718074]">Yield</p><p className="mt-1 text-2xl font-semibold text-[var(--kinja-green)]">{preview}</p></div>
    </div>
    <FormFooter error={error} label="Save batch" pending={pending} pendingLabel="Saving…"><Link className="inline-flex h-12 items-center px-3 font-semibold text-[#5d685e]" href="/dashboard/manufacturer/batches">Cancel</Link></FormFooter>
  </FormCard>;
}
