"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [pending, setPending] = useState(false);

  return <button className={`${className} ${pending ? "cursor-wait opacity-80" : ""}`} disabled={pending} onClick={(event) => { if (event.currentTarget.form?.checkValidity()) window.setTimeout(() => setPending(true), 0); }} type="submit" aria-busy={pending}>{pending && <LoaderCircle aria-hidden="true" className="animate-spin" />}{pending ? "Please wait..." : children}</button>;
}