"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const itemClass = "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-[#344e41] outline-none data-[highlighted]:bg-[#f0f4ed] data-[disabled]:cursor-default data-[disabled]:opacity-50";

// The "⋯" actions menu at the end of a table row.
export function RowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return <Menu.Root>
    <Menu.Trigger aria-label={label} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5d685e] transition hover:bg-[#f0f4ed] hover:text-[var(--kinja-green)] data-[popup-open]:bg-[#e7eee4] data-[popup-open]:text-[var(--kinja-green)]"><MoreHorizontal size={18} aria-hidden="true" /></Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner align="end" className="z-50 outline-none" sideOffset={6}>
        <Menu.Popup className="min-w-44 rounded-xl border border-[#dce2d9] bg-white p-1.5 shadow-lg shadow-black/5 outline-none transition data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}

export function RowMenuLink({ href, icon, children }: { href: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <Menu.Item className={itemClass} render={<Link href={href} />}>{icon}{children}</Menu.Item>;
}

// A file download; when disabled, the reason shows under the label.
export function RowMenuDownload({ href, icon, children, disabledReason }: { href: string; icon?: React.ReactNode; children: React.ReactNode; disabledReason?: string }) {
  if (disabledReason) return <Menu.Item className={cn(itemClass, "min-h-12 items-start py-2")} disabled>{icon && <span className="mt-0.5">{icon}</span>}<span>{children}<span className="block text-xs font-normal text-[#718074]">{disabledReason}</span></span></Menu.Item>;
  return <Menu.Item className={itemClass} render={<a download href={href} />}>{icon}{children}</Menu.Item>;
}

export function RowMenuItem({ onClick, icon, children, disabled, tone }: { onClick: () => void; icon?: React.ReactNode; children: React.ReactNode; disabled?: boolean; tone?: "danger" }) {
  return <Menu.Item className={cn(itemClass, tone === "danger" && "text-[#9b2c1f] data-[highlighted]:bg-[#fdf1ef]")} disabled={disabled} onClick={onClick}>{icon}{children}</Menu.Item>;
}
