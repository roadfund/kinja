import { ChartHover } from "@/components/charts/chart-hover";
import { tipAttr, type Tip } from "@/components/charts/tip";
import { cn } from "@/lib/utils";

// Kinja charts: green on white. One green carries every single-measure chart; where a chart
// splits by status, delivered is solid green, pending a lighter green and cancelled red, always
// named in a legend and beside the bar, so color is never the only key. Bars are plain HTML,
// rendered on the server: light on low-end phones, sharp at any width, no chart library.
export const GREEN = "#2f6b4f";
export const GREEN_LIGHT = "#8fbb9f";
export const RED = "#c8473d";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export const compactNumber = (value: number) => compact.format(value);

// Clean axis ticks: 0, then round steps (1, 2, 2.5 or 5 x 10^n) up past the largest value.
export function niceTicks(max: number, count = 4, minStep = 0): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(minStep, [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough)!);
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => index * step);
}

export function ChartCard({ title, description, legend, table, children, className }: { title: string; description?: string; legend?: Array<{ label: string; color: string }>; table?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[#dce2d9] bg-white p-5 sm:p-6", className)}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold text-[var(--kinja-green)]">{title}</h3>{description && <p className="mt-1 text-sm text-[#718074]">{description}</p>}</div>
      {legend && <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5d685e]">{legend.map((item) => <li className="flex items-center gap-1.5" key={item.label}><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />{item.label}</li>)}</ul>}
    </div>
    <div className="mt-5">{children}</div>
    {table && <details className="group mt-4 border-t border-[#eef1eb] pt-3"><summary className="cursor-pointer select-none text-sm font-semibold text-[var(--kinja-green)] marker:text-[#9aa69c]">View as table</summary><div className="-mt-2">{table}</div></details>}
  </section>;
}

export type BarDatum = { label: string; value: number; display: string; tip: Tip; color?: string };

// Horizontal bars, largest first: a label, a thin bar from a shared baseline, the value at its tip.
export function HBarChart({ data, empty = "Nothing to show yet." }: { data: BarDatum[]; empty?: string }) {
  const max = Math.max(0, ...data.map((item) => item.value));
  if (data.length === 0 || max === 0) return <p className="py-6 text-center text-sm text-[#718074]">{empty}</p>;
  return <ChartHover>
    <ul className="grid gap-2.5">{data.map((item) => <li aria-label={`${item.label}: ${item.display}`} className="grid cursor-default grid-cols-[minmax(5rem,9rem)_1fr] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#344e41]/30" data-tip={tipAttr(item.tip)} key={item.label} tabIndex={0}>
      <span className="truncate text-sm text-[#344e41]" title={item.label}>{item.label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-5 rounded-r transition-opacity hover:opacity-80" style={{ width: `${Math.max(item.value > 0 ? 0.6 : 0, (item.value / max) * 82)}%`, background: item.color ?? GREEN }} />
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-[#5d685e]">{item.display}</span>
      </span>
    </li>)}</ul>
  </ChartHover>;
}

export type StackDatum = { label: string; total: number; display: string; tip: Tip; parts: Array<{ value: number; color: string }> };

// Horizontal stacked bars: each row's parts sit side by side with a 2px white gap between them.
export function StackedBarChart({ data }: { data: StackDatum[] }) {
  const max = Math.max(0, ...data.map((item) => item.total));
  if (data.length === 0 || max === 0) return <p className="py-6 text-center text-sm text-[#718074]">Nothing to show yet.</p>;
  return <ChartHover>
    <ul className="grid gap-2.5">{data.map((item) => <li aria-label={`${item.label}: ${item.display}`} className="grid cursor-default grid-cols-[minmax(5rem,9rem)_1fr] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#344e41]/30" data-tip={tipAttr(item.tip)} key={item.label} tabIndex={0}>
      <span className="truncate text-sm text-[#344e41]" title={item.label}>{item.label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-5 gap-[2px] overflow-hidden rounded-r" style={{ width: `${(item.total / max) * 82}%` }}>{item.parts.filter((part) => part.value > 0).map((part, index) => <span className="h-full" key={index} style={{ flexGrow: part.value, flexBasis: 0, background: part.color }} />)}</span>
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-[#5d685e]">{item.display}</span>
      </span>
    </li>)}</ul>
  </ChartHover>;
}

export type ColumnDatum = { key: string; axisLabel: string; value: number; tip: Tip };

// Columns over time on one green, with clean y ticks and only the peak labelled.
// `whole` keeps axis steps to whole numbers, for counts.
export function ColumnChart({ data, formatTick, peakLabel, empty = "Nothing in this period.", whole = false }: { data: ColumnDatum[]; formatTick: (value: number) => string; peakLabel: (value: number) => string; empty?: string; whole?: boolean }) {
  const max = Math.max(0, ...data.map((item) => item.value));
  if (data.length === 0 || max === 0) return <p className="py-10 text-center text-sm text-[#718074]">{empty}</p>;
  const ticks = niceTicks(max, 4, whole ? 1 : 0);
  const top = ticks[ticks.length - 1];
  const peak = data.reduce((best, item) => (item.value > best.value ? item : best), data[0]);
  // Show at most about 12 axis labels (half of them on phones) so they never collide.
  const every = Math.max(1, Math.ceil(data.length / 12));
  return <ChartHover>
    <div className="grid grid-cols-[auto_1fr] gap-x-2 pt-4">
      <div className="relative h-56 text-right text-[11px] tabular-nums text-[#9aa69c]">{ticks.map((tick) => <span className="absolute right-0 -translate-y-1/2 whitespace-nowrap" key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>{formatTick(tick)}</span>)}<span className="invisible block whitespace-nowrap">{formatTick(top)}</span></div>
      <div className="relative h-56">
        {ticks.map((tick) => <span aria-hidden="true" className={cn("absolute inset-x-0 h-px", tick === 0 ? "bg-[#cbd2c9]" : "bg-[#eef1eb]")} key={tick} style={{ bottom: `${(tick / top) * 100}%` }} />)}
        <div className="absolute inset-0 flex items-end gap-[2px]">{data.map((item) => <div aria-label={`${item.tip.title}: ${item.tip.rows[0]?.[1] ?? ""}`} className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none focus-visible:bg-[#f0f4ed]" data-tip={tipAttr(item.tip)} key={item.key} tabIndex={0}>
          <span className="w-full max-w-6 rounded-t transition-opacity group-hover:opacity-80" style={{ height: `${(item.value / top) * 100}%`, minHeight: item.value > 0 ? 2 : 0, background: GREEN }} />
          {item === peak && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pb-1 text-[11px] font-semibold text-[#344e41]" style={{ bottom: `${(item.value / top) * 100}%` }}>{peakLabel(item.value)}</span>}
        </div>)}</div>
      </div>
      <span />
      <div className="mt-2 flex gap-[2px] text-[11px] text-[#718074]">{data.map((item, index) => <span className={cn("min-w-0 flex-1 overflow-visible whitespace-nowrap text-center", index % (every * 2) !== 0 && "invisible sm:visible")} key={item.key}>{index % every === 0 ? item.axisLabel : ""}</span>)}</div>
    </div>
  </ChartHover>;
}

// Groups records into consecutive months (empty months kept, so gaps show as gaps), ending
// with the latest month that has data and covering at most the last `limit` months.
export function monthBuckets<T>(items: T[], date: (item: T) => string, limit = 18): Array<{ key: string; axisLabel: string; title: string; items: T[] }> {
  const keys = items.map((item) => date(item).slice(0, 7)).sort();
  if (keys.length === 0) return [];
  const last = keys[keys.length - 1];
  const cursor = new Date(`${keys[0]}-01T00:00:00Z`);
  const start = new Date(`${last}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - (limit - 1));
  if (cursor < start) cursor.setTime(start.getTime());
  const buckets: Array<{ key: string; axisLabel: string; title: string; items: T[] }> = [];
  for (; cursor.toISOString().slice(0, 7) <= last; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const key = cursor.toISOString().slice(0, 7);
    buckets.push({ key, axisLabel: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }), title: cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), items: items.filter((item) => date(item).startsWith(key)) });
  }
  return buckets;
}
