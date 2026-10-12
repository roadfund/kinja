"use client";

import { Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";

type CustomerValues = { id: string; name: string; phone?: string; email?: string; address?: string; paymentTermsDays: number };

export function CustomerForm({ customer, backHref }: { customer?: CustomerValues; backHref: string }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (await run(customer ? `/market/customers/${customer.id}` : "/market/customers", body, customer ? "PUT" : "POST")) {
      router.push(backHref);
      router.refresh();
    }
  }

  return <FormCard description="Customers belong to your hub. Payment terms set the due date on their invoices." icon={<Store size={20} aria-hidden="true" />} onSubmit={submit} title={customer ? "Edit customer" : "New customer"}>
    <div className="grid gap-5 sm:grid-cols-2">
      <Label required text="Name"><input className={inputClass} defaultValue={customer?.name} maxLength={120} minLength={2} name="name" placeholder="e.g. Red Light Market Stall 4" required /></Label>
      <Label required text="Payment terms (days)"><input className={inputClass} defaultValue={customer?.paymentTermsDays ?? 30} max={365} min={0} name="paymentTermsDays" required type="number" /></Label>
      <Label hint="(optional)" text="Phone"><input className={inputClass} defaultValue={customer?.phone} maxLength={30} name="phone" placeholder="+231 77 000 000" type="tel" /></Label>
      <Label hint="(optional)" text="Email"><input className={inputClass} defaultValue={customer?.email} name="email" type="email" /></Label>
      <Label hint="(optional)" text="Address"><input className={inputClass} defaultValue={customer?.address} maxLength={200} name="address" /></Label>
    </div>
    <FormFooter error={error} label={customer ? "Save changes" : "Add customer"} pending={pending} pendingLabel="Saving…"><Link className="inline-flex h-12 items-center px-3 font-semibold text-[#5d685e]" href={backHref}>Cancel</Link></FormFooter>
  </FormCard>;
}
