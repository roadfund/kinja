"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100];

// Pages of rows under a scrollable table. The rows are rendered on the server; this only
// chooses which page to show, so no table needs to load more as you scroll.
// Search matches every word typed, anywhere in a row's text.
export function TablePager({ frameClass, tableClass, head, rows: allRows, search, pageSize: initialSize = 10 }: { frameClass: string; tableClass: string; head: React.ReactNode; rows: React.ReactNode[]; search: string[]; pageSize?: number }) {
  const [size, setSize] = useState(initialSize);
  const [requested, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = words.length ? allRows.filter((_, index) => words.every((word) => search[index].includes(word))) : allRows;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  // Filters can shrink the list; never show a page past the end.
  const page = Math.min(requested, pages);
  const first = (page - 1) * size;
  const shown = rows.slice(first, first + size);

  return <div className="mt-5">
    {allRows.length > PAGE_SIZES[0] && <div className="relative mb-3 max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69c]" size={16} aria-hidden="true" />
      <input aria-label="Search this table" className="h-11 w-full rounded-xl border border-[#cbd2c9] bg-white pl-9 pr-9 text-sm outline-none placeholder:text-[#9aa69c] focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search" type="search" value={query} />
      {query && <button aria-label="Clear search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#718074] hover:bg-[#eef1eb]" onClick={() => { setQuery(""); setPage(1); }} type="button"><X size={14} aria-hidden="true" /></button>}
    </div>}
    <div className={cn(frameClass, "mt-0")}><table className={tableClass}><thead>{head}</thead><tbody>{shown}</tbody></table>{rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-[#718074]">No rows match &ldquo;{query}&rdquo;.</p>}</div>
    {(rows.length > PAGE_SIZES[0] || size !== initialSize) && <nav aria-label="Table pages" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[#5d685e]">
      <div className="flex items-center gap-3">
        <span>Showing <span className="font-semibold text-[#344e41]">{rows.length ? first + 1 : 0}–{Math.min(first + size, rows.length)}</span> of <span className="font-semibold text-[#344e41]">{rows.length}</span>{words.length > 0 && ` (filtered from ${allRows.length})`}</span>
        <label className="flex items-center gap-2">Rows<select className="h-9 rounded-lg border border-[#cbd2c9] bg-white px-2 text-sm text-[#344e41]" onChange={(event) => { setSize(Number(event.target.value)); setPage(1); }} value={size}>{PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      </div>
      <div className="flex items-center gap-1">
        <PageButton disabled={page === 1} label="Previous page" onClick={() => setPage(page - 1)}><ChevronLeft size={16} aria-hidden="true" /></PageButton>
        {pageList(page, pages).map((item, index) => item === "…" ? <span className="px-1.5 text-[#9aa69c]" key={`gap-${index}`}>…</span> : <PageButton current={item === page} key={item} label={`Page ${item}`} onClick={() => setPage(item)}>{item}</PageButton>)}
        <PageButton disabled={page === pages} label="Next page" onClick={() => setPage(page + 1)}><ChevronRight size={16} aria-hidden="true" /></PageButton>
      </div>
    </nav>}
  </div>;
}

function PageButton({ children, label, onClick, disabled, current }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; current?: boolean }) {
  return <button aria-current={current ? "page" : undefined} aria-label={label} className={cn("inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-semibold transition disabled:opacity-40", current ? "bg-[var(--kinja-green)] text-white" : "text-[#344e41] hover:bg-[#eef1eb]")} disabled={disabled} onClick={onClick} type="button">{children}</button>;
}

// 1 … 4 5 6 … 23: the first and last pages, and two either side of the current one.
export function pageList(page: number, pages: number): Array<number | "…"> {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((item) => item >= 1 && item <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((item, index) => (index > 0 && item - sorted[index - 1] > 1 ? ["…" as const, item] : [item]));
}
