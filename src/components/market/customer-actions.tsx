"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { RowMenu, RowMenuItem, RowMenuLink } from "@/components/kinja/row-menu";
import { useJsonAction } from "@/components/kinja/use-json-action";

// The row's "⋯" menu: edit, or archive and restore (customers are never deleted).
export function CustomerActions({ customerId, archived, editHref }: { customerId: string; archived: boolean; editHref: string }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  return <span className="inline-flex items-center gap-2 md:justify-end">
    {error && <span className="text-xs text-destructive" role="alert">{error}</span>}
    <RowMenu label="Customer actions">
      <RowMenuLink href={editHref} icon={<Pencil size={15} aria-hidden="true" />}>Edit</RowMenuLink>
      <RowMenuItem disabled={pending} icon={archived ? <ArchiveRestore size={15} aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />} onClick={async () => { if (await run(`/market/customers/${customerId}/archive`, { archived: !archived })) router.refresh(); }} tone={archived ? undefined : "danger"}>{archived ? "Restore" : "Archive"}</RowMenuItem>
    </RowMenu>
  </span>;
}
