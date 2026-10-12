"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inputClass, Label } from "@/components/kinja/form";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Moderation actions and voids always need a reason, which goes into the audit log.
export function ReasonAction({ endpoint, body = {}, triggerLabel, title, description, confirmLabel, destructive = true }: { endpoint: string; body?: Record<string, unknown>; triggerLabel: string; title: string; description: string; confirmLabel: string; destructive?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending, error, setError } = useJsonAction();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    if (await run(endpoint, { ...body, reason })) {
      setOpen(false);
      router.refresh();
    }
  }

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(""); }}>
    <DialogTrigger render={<Button size="sm" type="button" variant={destructive ? "destructive" : "outline"} />}>{triggerLabel}</DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <form className="grid gap-4" onSubmit={submit}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <Label required text="Reason"><textarea className={`${inputClass} h-24 py-3`} maxLength={500} minLength={3} name="reason" placeholder="Recorded in the audit log" required /></Label>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button disabled={pending} type="button" variant="outline" />}>Cancel</DialogClose>
          <Button disabled={pending} type="submit" variant={destructive ? "destructive" : "default"}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}{confirmLabel}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
