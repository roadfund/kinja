"use client";

import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormCard, FormFooter, inputClass, Label } from "@/components/kinja/form";
import { RowMenu, RowMenuItem } from "@/components/kinja/row-menu";
import { useJsonAction } from "@/components/kinja/use-json-action";

export function AddCropForm() {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved("");
    if (await run("/ops/crops", { name })) {
      setSaved(`${name.trim()} added. Hubs can now switch it on in hub setup.`);
      setName("");
      router.refresh();
    }
  }

  return <FormCard description="Hubs choose their crops from this list, then set their own grades and prices." icon={<Plus size={20} aria-hidden="true" />} onSubmit={submit} title="Add a crop">
    <Label required text="Crop name"><input className={inputClass} maxLength={60} minLength={2} onChange={(event) => { setName(event.target.value); setSaved(""); }} placeholder="e.g. Cocoa" required value={name} /></Label>
    <FormFooter error={error} label="Add crop" pending={pending} pendingLabel="Adding…" success={saved} />
  </FormCard>;
}

// "⋯" on a crop: archive it (hidden from hub setup and new records) or restore it.
export function CropActions({ cropId, name, archived }: { cropId: string; name: string; archived: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  return <span className="inline-flex items-center gap-2">
    {error && <span className="text-xs text-destructive" role="alert">{error}</span>}
    <RowMenu label={`Actions for ${name}`}>
      <RowMenuItem disabled={pending} icon={archived ? <ArchiveRestore size={15} aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />} onClick={async () => { if (await run(`/ops/crops/${cropId}/archive`, { archived: !archived })) router.refresh(); }} tone={archived ? undefined : "danger"}>{archived ? "Restore" : "Archive"}</RowMenuItem>
    </RowMenu>
  </span>;
}
