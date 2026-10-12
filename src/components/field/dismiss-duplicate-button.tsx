"use client";

import { useRouter } from "next/navigation";
import { useJsonAction } from "@/components/kinja/use-json-action";
import { Button } from "@/components/ui/button";

export function DismissDuplicateButton({ farmerId }: { farmerId: string }) {
  const router = useRouter();
  const { run, pending, error } = useJsonAction();
  return <span className="inline-flex items-center gap-2"><Button disabled={pending} onClick={async () => { if (await run(`/field/farmers/${farmerId}/dismiss-duplicate`)) router.refresh(); }} size="sm" type="button" variant="outline">Not a duplicate</Button>{error && <span className="text-xs text-destructive">{error}</span>}</span>;
}
