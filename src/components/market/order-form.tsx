"use client";

import { Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import type { OrderCategory, OrderChannel } from "@/domain/model";
import { Money } from "@/components/kinja/money";
import { moneyItem, type MoneyContext } from "@/domain/currency";
import { amountForWeight, minorToInput, toMinor } from "@/domain/money";

type StockOption = { batchId: string; productId: string; label: string; available: string; unitLabel: string; lastPrices: Record<string, number> };
type Line = { key: number; batchId: string; quantity: string; price: string };
const QUANTITY = /^\d+(\.\d{1,3})?$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

export function OrderForm({ customers, stock, money, today, categories, channels, deliveredByNames }: { customers: Array<{ id: string; name: string }>; stock: StockOption[]; money: MoneyContext; today: string; categories: Record<OrderCategory, string>; channels: Record<OrderChannel, string>; deliveredByNames: string[] }) {
  const router = useRouter();
  const { run, pending, error, setError } = useJsonAction();
  const [currency, setCurrency] = useState(money.primary);
  // The last price charged for the product in this currency, as a starting point.
  const priceFor = (batchId: string, inCurrency = currency) => { const price = stock.find((item) => item.batchId === batchId)?.lastPrices[inCurrency]; return price === undefined ? "" : minorToInput(price); };
  const newLine = (key: number, batchId = stock[0]?.batchId ?? ""): Line => ({ key, batchId, quantity: "", price: priceFor(batchId) });
  const [lines, setLines] = useState<Line[]>([newLine(0)]);
  const [discount, setDiscount] = useState("");
  const [delivered, setDelivered] = useState(true);

  const update = (key: number, change: Partial<Line>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...change, ...(change.batchId ? { price: priceFor(change.batchId) } : {}) } : line));
  const amounts = lines.map((line) => QUANTITY.test(line.quantity) && line.price ? amountForWeight(line.quantity, toMinor(line.price)) : 0);
  const gross = amounts.reduce((sum, amount) => sum + amount, 0);
  const basisPoints = PERCENT.test(discount.trim()) ? toMinor(discount) : 0;
  const discountMinor = Math.round((gross * Math.min(basisPoints, 10_000)) / 10_000);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (discount.trim() && (!PERCENT.test(discount.trim()) || basisPoints > 10_000)) return setError("Discount must be a percent between 0 and 100");
    const data = new FormData(event.currentTarget);
    const body = { customerId: data.get("customerId"), orderedOn: data.get("orderedOn"), currency, category: data.get("category"), channel: data.get("channel"), deliveredBy: data.get("deliveredBy"), discountBasisPoints: basisPoints, delivered, lines: lines.map((line) => ({ batchId: line.batchId, quantity: line.quantity.trim(), unitPriceMinor: toMinor(line.price) })) };
    if (await run("/market/orders", body)) {
      router.push("/dashboard/distributor/orders");
      router.refresh();
    }
  }

  return <FormCard description="Add one line per SKU. Each line is a sale linked to its batch, so it traces back to the farmers." icon={<ShoppingBag size={20} aria-hidden="true" />} onSubmit={submit} title="New order">
    <div className="grid gap-5 sm:grid-cols-2">
      <Label required text="Customer"><select className={inputClass} name="customerId" required><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></Label>
      <Label required text="Order date"><input className={inputClass} defaultValue={today} max={today} name="orderedOn" required type="date" /></Label>
      {money.currencies.length > 1 && <Label required text="Currency"><select className={inputClass} onChange={(event) => { const next = event.target.value; setCurrency(next); setLines((current) => current.map((line) => ({ ...line, price: priceFor(line.batchId, next) }))); }} value={currency}>{money.currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select></Label>}
      <Label required text="Customer category"><select className={inputClass} defaultValue="WHOLESALE" name="category" required>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Label>
      <Label required text="Ordering channel"><select className={inputClass} defaultValue="PHONE" name="channel" required>{Object.entries(channels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Label>
    </div>

    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-[#344e41]">Products<span className="text-[#b42318]"> *</span></legend>
      {lines.map((line, index) => {
        const selected = stock.find((item) => item.batchId === line.batchId);
        return <div className="grid gap-3 rounded-xl border border-[#eef1eb] bg-[#fbfcfa] p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" key={line.key}>
          <Label text={`SKU and batch ${lines.length > 1 ? index + 1 : ""}`.trim()}><select className={inputClass} onChange={(event) => update(line.key, { batchId: event.target.value })} required value={line.batchId}>{stock.map((item) => <option key={item.batchId} value={item.batchId}>{item.label} · {item.available} {item.unitLabel} in stock</option>)}</select></Label>
          <Label text={`Quantity (${selected?.unitLabel ?? "units"})`}><input className={inputClass} inputMode="decimal" max={selected?.available} min="0.001" onChange={(event) => update(line.key, { quantity: event.target.value })} required step="0.001" type="number" value={line.quantity} /></Label>
          <Label text={`Price per ${selected?.unitLabel === "kg" ? "kg" : "unit"} (${currency})`}><input className={inputClass} inputMode="decimal" min="0" onChange={(event) => update(line.key, { price: event.target.value })} required step="0.01" type="number" value={line.price} /></Label>
          <button aria-label={`Remove line ${index + 1}`} className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#cbd2c9] bg-white text-[#9b2c1f] disabled:opacity-40" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} type="button"><Trash2 size={17} aria-hidden="true" /></button>
        </div>;
      })}
      <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-dashed border-[#cbd2c9] px-4 text-sm font-semibold text-[var(--kinja-green)] disabled:opacity-50" disabled={lines.length >= Math.min(20, stock.length * 2)} onClick={() => setLines((current) => [...current, newLine(Math.max(...current.map((line) => line.key)) + 1, stock.find((item) => !current.some((line) => line.batchId === item.batchId))?.batchId)])} type="button"><Plus size={16} aria-hidden="true" />Add another SKU</button>
    </fieldset>

    <div className="grid gap-5 sm:grid-cols-2">
      <Label hint="(optional)" text="Discount (%)"><input className={inputClass} inputMode="decimal" max="100" min="0" onChange={(event) => setDiscount(event.target.value)} placeholder="0" step="0.01" type="number" value={discount} /></Label>
      <Label hint="(optional)" text="Delivered by"><input className={inputClass} list="delivered-by-names" maxLength={120} name="deliveredBy" placeholder="Who takes it to the customer" /><datalist id="delivered-by-names">{deliveredByNames.map((name) => <option key={name} value={name} />)}</datalist></Label>
    </div>
    <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#dce2d9] px-4 text-sm font-medium text-[#344e41]"><input checked={delivered} className="h-5 w-5 accent-[var(--kinja-green)]" onChange={(event) => setDelivered(event.target.checked)} type="checkbox" />Already delivered to the customer<span className="font-normal text-[#718074]">(otherwise saved as pending)</span></label>

    <div className="grid gap-3 rounded-xl bg-[#f7f9f5] p-4 sm:grid-cols-3">
      <div><p className="text-sm text-[#718074]">Order value</p><Money className="mt-1 text-xl font-semibold text-[#344e41]" context={money} value={moneyItem(gross, currency)} /></div>
      <div><p className="text-sm text-[#718074]">Discount</p><Money className="mt-1 text-xl font-semibold text-[#344e41]" context={money} value={moneyItem(discountMinor, currency)} /></div>
      <div><p className="text-sm text-[#718074]">Payment value</p><Money className="mt-1 text-2xl font-semibold text-[var(--kinja-green)]" context={money} value={moneyItem(gross - discountMinor, currency)} /></div>
    </div>
    <FormFooter error={error} label="Save order" pending={pending} pendingLabel="Saving…"><Link className="inline-flex h-12 items-center px-3 font-semibold text-[#5d685e]" href="/dashboard/distributor/orders">Cancel</Link></FormFooter>
  </FormCard>;
}
