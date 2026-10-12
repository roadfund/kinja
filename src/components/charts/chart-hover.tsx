"use client";

import { useRef, useState } from "react";

import type { Tip } from "@/components/charts/tip";

type Shown = Tip & { x: number; y: number; width: number };

function readTip(element: Element | null): { tip: Tip; mark: HTMLElement } | null {
  const mark = element?.closest<HTMLElement>("[data-tip]");
  if (!mark?.dataset.tip) return null;
  try { return { tip: JSON.parse(mark.dataset.tip) as Tip, mark }; } catch { return null; }
}

// The hover layer for a server-rendered chart: one tooltip that follows the pointer over any
// mark carrying data-tip, and shows the same details when a mark gets keyboard focus or a tap.
// Text is rendered by React (never as HTML), and every value is also in the chart's table view.
export function ChartHover({ children, className }: { children: React.ReactNode; className?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  function showAt(element: Element | null, clientX?: number, clientY?: number) {
    const found = readTip(element);
    const box = frame.current?.getBoundingClientRect();
    if (!found || !box) return setShown(null);
    const markBox = found.mark.getBoundingClientRect();
    const x = (clientX ?? markBox.left + markBox.width / 2) - box.left;
    const y = (clientY ?? markBox.top) - box.top;
    setShown({ ...found.tip, x, y, width: box.width });
  }

  // Keep the tooltip inside the chart: flip to the left of the pointer near the right edge.
  const flip = shown ? shown.x > shown.width - 220 : false;

  return <div className={`relative ${className ?? ""}`} onBlur={() => setShown(null)} onFocus={(event) => showAt(event.target)} onPointerDown={(event) => showAt(event.target as Element, event.clientX, event.clientY)} onPointerLeave={() => setShown(null)} onPointerMove={(event) => showAt(event.target as Element, event.clientX, event.clientY)} ref={frame}>
    {children}
    {shown && <div className="pointer-events-none absolute z-20 min-w-40 max-w-64 rounded-xl border border-[#dce2d9] bg-white px-3 py-2.5 text-xs shadow-lg shadow-black/5" role="status" style={{ left: flip ? undefined : shown.x + 14, right: flip ? shown.width - shown.x + 14 : undefined, top: Math.max(0, shown.y - 12) }}>
      <p className="font-medium text-[#718074]">{shown.title}</p>
      <dl className="mt-1.5 grid gap-1">{shown.rows.map(([name, value]) => <div className="flex items-baseline justify-between gap-4" key={name}><dt className="text-[#718074]">{name}</dt><dd className="font-semibold tabular-nums text-[#1f2a22]">{value}</dd></div>)}</dl>
    </div>}
  </div>;
}
