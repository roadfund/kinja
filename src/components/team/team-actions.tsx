"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function CopyInviteLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard?.writeText(`${window.location.origin}/auth/invite/${code}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return <Button onClick={copy} size="sm" type="button" variant="outline">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy link"}</Button>;
}

// A destructive action behind a confirmation dialog. Posts to `endpoint`, then refreshes the page.
function ConfirmAction({ endpoint, triggerLabel, title, description, confirmLabel }: { endpoint: string; triggerLabel: string; title: string; description: string; confirmLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST" });
      if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "Something went wrong.");
      setOpen(false);
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error && actionError.message !== "Failed to fetch" ? actionError.message : "Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(""); }}>
    <DialogTrigger render={<Button size="sm" type="button" variant="destructive" />}>{triggerLabel}</DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <DialogFooter>
        <DialogClose render={<Button disabled={pending} type="button" variant="outline" />}>Cancel</DialogClose>
        <Button disabled={pending} onClick={confirm} type="button" variant="destructive">{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}{confirmLabel}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function RevokeInviteButton({ inviteId, label }: { inviteId: string; label: string }) {
  return <ConfirmAction confirmLabel="Revoke invite" description={`${label} will no longer be able to use this invite. You can send a new one later.`} endpoint={`/team/invites/${inviteId}/revoke`} title="Revoke this invite?" triggerLabel="Revoke" />;
}

export function RemoveMemberButton({ membershipId, name }: { membershipId: string; name: string }) {
  return <ConfirmAction confirmLabel="Remove member" description={`${name} will lose access straight away and be signed out on every device. Their past records stay in Kinja.`} endpoint={`/team/members/${membershipId}/remove`} title={`Remove ${name}?`} triggerLabel="Remove" />;
}
