"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType2 } from "lucide-react";

const formats = [
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", icon: FileType2 },
] as const;

// One "Export" button; its menu lists each dataset on the page with PDF, Excel and CSV downloads.
export function ExportMenu({ datasets, hubId }: { datasets: Array<{ dataset: string; label: string }>; hubId?: string }) {
  const href = (dataset: string, format: string) => `/exports/${dataset}?format=${format}${hubId ? `&hubId=${encodeURIComponent(hubId)}` : ""}`;
  return <Menu.Root>
    <Menu.Trigger className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#cbd2c9] bg-white px-4 font-semibold text-[var(--kinja-green)] transition hover:bg-[#f7f9f5] data-[popup-open]:bg-[#f0f4ed]"><Download size={17} aria-hidden="true" />Export<ChevronDown className="text-[#718074]" size={16} aria-hidden="true" /></Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner align="end" className="z-50 outline-none" sideOffset={6}>
        <Menu.Popup className="max-h-[70vh] min-w-52 overflow-y-auto rounded-xl border border-[#dce2d9] bg-white p-1.5 shadow-lg shadow-black/5 outline-none transition data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
          {datasets.map(({ dataset, label }, index) => <Menu.Group className={index > 0 ? "mt-1 border-t border-[#eef1eb] pt-1" : undefined} key={dataset}>
            {datasets.length > 1 && <Menu.GroupLabel className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#718074]">{label}</Menu.GroupLabel>}
            {formats.map(({ format, label: formatLabel, icon: Icon }) => <Menu.Item className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-[#344e41] outline-none data-[highlighted]:bg-[#f0f4ed]" key={format} render={<a download href={href(dataset, format)} />}><Icon className="text-[#718074]" size={15} aria-hidden="true" />{formatLabel}</Menu.Item>)}
          </Menu.Group>)}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}
