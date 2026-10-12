"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { Money } from "@/components/kinja/money";
import { moneyItem, type MoneyContext } from "@/domain/currency";

type OpenSale = { id: string; customerId: string; label: string; amountMinor: number; currency: string; at: string };

export function InvoiceForm({ customers, sales, money }: { customers: Array<{ id: string; name: string; paymentTermsDays: number }>; sales: OpenSale[]; money: MoneyContext }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const customer = customers.find((item) => item.id === customerId);
  const available = sales.filter((sale) => sale.customerId === customerId);
  const chosen = available.filter((sale) => selected.includes(sale.id));
  // An invoice is in one currency: once a sale is ticked, sales in other currencies are locked.
  const invoiceCurrency = chosen[0]?.currency;
  const total = chosen.reduce((sum, sale) => sum + sale.amountMinor, 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invoice = await run<{ id: string }>("/market/invoices", { customerId, saleIds: selected });
    if (invoice) {
      router.push(`/dashboard/distributor/invoices/${invoice.id}`);
      router.refresh();
    }
  }

  return <FormCard description="Invoices are numbered automatically. The due date follows the customer's payment terms." icon={<FileText size={20} aria-hidden="true" />} onSubmit={submit} title="Issue an invoice">
    <Label required text="Customer"><select className={inputClass} onChange={(event) => { setCustomerId(event.target.value); setSelected([]); }} required value={customerId}>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Label>
    <fieldset>
      <legend className="text-sm font-medium text-[#344e41]">Sales to invoice <span className="text-[#b42318]">*</span></legend>
      <div className="mt-2 divide-y divide-[#eef1eb] rounded-xl border border-[#dce2d9]">{available.map((sale) => <label className={`flex min-h-12 items-center gap-3 px-4 py-2 text-sm ${invoiceCurrency && sale.currency !== invoiceCurrency ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`} key={sale.id}><input checked={selected.includes(sale.id)} className="h-5 w-5 accent-[var(--kinja-green)]" disabled={Boolean(invoiceCurrency) && sale.currency !== invoiceCurrency} onChange={(event) => setSelected(event.target.checked ? [...selected, sale.id] : selected.filter((id) => id !== sale.id))} type="checkbox" /><span className="flex-1 text-[#344e41]">{sale.label}</span><Money className="text-right font-medium text-[#344e41]" context={money} value={moneyItem(sale.amountMinor, sale.currency, sale.at)} /></label>)}</div>
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl bg-[#f7f9f5] p-4"><p className="text-sm text-[#718074]">Invoice total</p><Money className="mt-1 text-2xl font-semibold text-[var(--kinja-green)]" context={money} value={moneyItem(total, invoiceCurrency ?? money.primary)} />{available.some((sale) => sale.currency !== available[0].currency) && <p className="mt-1 text-xs text-[#718074]">One currency per invoice. Issue a second invoice for the rest.</p>}</div>
      <div className="rounded-xl bg-[#f7f9f5] p-4"><p className="text-sm text-[#718074]">Due</p><p className="mt-1 text-2xl font-semibold text-[var(--kinja-green)]">{customer ? `${customer.paymentTermsDays} days after issue` : "—"}</p></div>
    </div>
    <FormFooter error={error || (selected.length === 0 ? "" : "")} label="Issue invoice" pending={pending} pendingLabel="Issuing…"><Link className="inline-flex h-12 items-center px-3 font-semibold text-[#5d685e]" href="/dashboard/distributor/invoices">Cancel</Link></FormFooter>
  </FormCard>;
}
