"use client";

import { Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { moneyItem, moneyLines, type MoneyContext } from "@/domain/currency";
import { minorToInput, toMinor } from "@/domain/money";

export function CollectionForm({ invoiceId, outstandingMinor, currency, money }: { invoiceId: string; outstandingMinor: number; currency: string; money: MoneyContext }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [saved, setSaved] = useState(false);
  const [amount, setAmount] = useState(minorToInput(outstandingMinor));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await run(`/market/invoices/${invoiceId}/collections`, { amountMinor: toMinor(String(data.get("amount"))), method: data.get("method"), reference: data.get("reference") })) {
      form.reset();
      setAmount("");
      setSaved(true);
      router.refresh();
    }
  }

  return <FormCard description="Record money received against this invoice." icon={<Wallet size={20} aria-hidden="true" />} onSubmit={submit} title="Record a collection">
    <div className="grid gap-5 sm:grid-cols-3">
      <Label required text={`Amount (${currency})`}><input className={inputClass} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} value={amount} max={minorToInput(outstandingMinor)} min="0.01" name="amount" required step="0.01" type="number" /></Label>
      <Label required text="Method"><select className={inputClass} name="method" required><option value="MOBILE_MONEY">Mobile money</option><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option></select></Label>
      <Label hint="(optional)" text="Reference"><input className={inputClass} maxLength={120} name="reference" placeholder="e.g. MoMo transaction ID" /></Label>
    </div>
    {money.currencies.length > 1 && /^\d+(\.\d{1,2})?$/.test(amount) && <p className="-mt-2 text-sm text-[#718074]">Equal to {moneyLines(money, moneyItem(toMinor(amount), currency)).slice(1).map((line) => line.text).join(" · ")} today</p>}
    <FormFooter error={error} label="Record collection" pending={pending} pendingLabel="Saving…" success={saved ? "Collection recorded." : undefined} />
  </FormCard>;
}
