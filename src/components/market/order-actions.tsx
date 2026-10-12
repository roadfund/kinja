"use client";

import { CircleCheck, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass, Label } from "@/components/kinja/form";
import { RowMenu, RowMenuItem } from "@/components/kinja/row-menu";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// "⋯" on a pending order: mark it delivered (who and when) or cancel it with a reason.
export function OrderActions({ orderId, label, orderedOn, today, deliveredBy, deliveredByNames }: { orderId: string; label: string; orderedOn: string; today: string; deliveredBy?: string; deliveredByNames: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<"deliver" | "cancel" | null>(null);
  const { run, pending, error, setError } = useJsonAction();
  const close = (next: boolean) => { if (!next) { setOpen(null); setError(""); } };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = open === "deliver"
      ? await run(`/market/orders/${orderId}/deliver`, { deliveredOn: data.get("deliveredOn"), deliveredBy: data.get("deliveredBy") })
      : await run(`/market/orders/${orderId}/cancel`, { reason: data.get("reason") });
    if (ok) { setOpen(null); router.refresh(); }
  }

  return <>
    <RowMenu label={`Actions for ${label}`}>
      <RowMenuItem icon={<CircleCheck size={15} aria-hidden="true" />} onClick={() => setOpen("deliver")}>Mark delivered</RowMenuItem>
      <RowMenuItem icon={<XCircle size={15} aria-hidden="true" />} onClick={() => setOpen("cancel")} tone="danger">Cancel order</RowMenuItem>
    </RowMenu>
    <Dialog onOpenChange={close} open={open !== null}>
      <DialogContent className="sm:max-w-md">
        <form className="grid gap-4" onSubmit={submit}>
          {open === "deliver" ? <>
            <DialogHeader><DialogTitle>Mark {label} delivered</DialogTitle><DialogDescription>Delivered orders count as sales and can be invoiced.</DialogDescription></DialogHeader>
            <Label required text="Delivery date"><input className={inputClass} defaultValue={today} max={today} min={orderedOn} name="deliveredOn" required type="date" /></Label>
            <Label text="Delivered by"><input className={inputClass} defaultValue={deliveredBy} list={`delivered-by-${orderId}`} maxLength={120} name="deliveredBy" /><datalist id={`delivered-by-${orderId}`}>{deliveredByNames.map((name) => <option key={name} value={name} />)}</datalist></Label>
          </> : <>
            <DialogHeader><DialogTitle>Cancel {label}?</DialogTitle><DialogDescription>Its sales are voided and the stock returns to you. This cannot be undone.</DialogDescription></DialogHeader>
            <Label required text="Reason"><textarea className={`${inputClass} h-24 py-3`} maxLength={500} minLength={3} name="reason" placeholder="Recorded in the audit log" required /></Label>
          </>}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button disabled={pending} type="button" variant="outline" />}>Back</DialogClose>
            <Button disabled={pending} type="submit" variant={open === "cancel" ? "destructive" : "default"}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}{open === "cancel" ? "Cancel order" : "Mark delivered"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
