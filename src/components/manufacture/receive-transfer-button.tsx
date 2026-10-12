"use client";

import { LoaderCircle, PackageCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// The receiving side records what actually arrived. A different amount flags a discrepancy.
export function ReceiveTransferButton({ transferId, quantitySent, unitLabel, fromName }: { transferId: string; quantitySent: string; unitLabel: string; fromName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(quantitySent);
  const { run, pending, error } = useJsonAction();
  const differs = quantity !== "" && Number(quantity) !== Number(quantitySent);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    if (await run(`/manufacture/transfers/${transferId}/receive`, { quantityReceived: quantity.trim(), note })) {
      setOpen(false);
      router.refresh();
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button size="sm" type="button" />}><PackageCheck aria-hidden="true" />Confirm receipt</DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <form className="grid gap-4" onSubmit={submit}>
        <DialogHeader><DialogTitle>Confirm what arrived</DialogTitle><DialogDescription>{fromName} sent {quantitySent} {unitLabel}. Enter the amount you received.</DialogDescription></DialogHeader>
        <Label required text={`Quantity received (${unitLabel})`}><input className={inputClass} inputMode="decimal" min="0" onChange={(event) => setQuantity(event.target.value)} required step="0.001" type="number" value={quantity} /></Label>
        {differs && <p className="rounded-lg bg-[#fff5d9] px-3 py-2 text-sm text-[#8b6818]">This differs from what was sent, so it will be flagged as a discrepancy for both sides and the hub admin.</p>}
        <Label hint="(optional)" text="Note"><input className={inputClass} maxLength={500} name="note" placeholder={differs ? "e.g. Two bags were damp" : "Anything to note"} /></Label>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button disabled={pending} type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending} type="submit">{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Confirm receipt</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
