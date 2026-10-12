import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TablePager } from "@/components/kinja/table-pager";
import { cn } from "@/lib/utils";

// The content of every dashboard page: a back link, a heading, optional header actions and
// full-width content. The sidebar comes from the shared layout (AppFrame).
export function DashboardShell({ eyebrow, title, description, back, actions, children }: { eyebrow: string; title: string; description?: string; back?: { href: string; label: string }; actions?: React.ReactNode; children: React.ReactNode }) {
  return <section className="px-4 py-8 sm:px-10">
    {back && <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--kinja-green)]" href={back.href}><ArrowLeft aria-hidden="true" size={16} />{back.label}</Link>}
    <header className={cn("flex flex-wrap items-end justify-between gap-4", back && "mt-8")}>
      <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--kinja-green)]">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--kinja-green)] sm:text-4xl">{title}</h1>{description && <p className="mt-3 max-w-2xl leading-7 text-[#5d685e]">{description}</p>}</div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
    <div className="mt-8">{children}</div>
  </section>;
}

export function SummaryGrid({ children, columns = 4 }: { children: React.ReactNode; columns?: 3 | 4 }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", columns === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>{children}</div>;
}

export function SummaryCard({ label, value, detail, tone }: { label: string; value: React.ReactNode; detail: React.ReactNode; tone?: "warning" }) {
  return <div className={cn("rounded-2xl bg-white p-5", tone === "warning" && "ring-1 ring-[#e4d9aa]")}><p className="text-sm text-[#718074]">{label}</p><p className={cn("mt-2 truncate text-3xl font-semibold", tone === "warning" ? "text-[#8b6818]" : "text-[var(--kinja-green)]")}>{value}</p><p className="mt-1 text-sm text-[#5d685e]">{detail}</p></div>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mt-10 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-[var(--kinja-green)]">{title}</h2>{description && <p className="mt-1 text-sm text-[#5d685e]">{description}</p>}</div>{action}</div>;
}

export function LinkButton({ href, icon, children, variant = "primary" }: { href: string; icon?: React.ReactNode; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return <Link className={cn("inline-flex h-12 shrink-0 items-center gap-2 rounded-xl px-5 font-semibold", variant === "primary" ? "bg-[var(--kinja-green)] text-white" : "border border-[#cbd2c9] bg-white text-[var(--kinja-green)]")} href={href}>{icon}{children}</Link>;
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 px-6 py-12 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e7eee4] text-[var(--kinja-green)]">{icon}</span><p className="mt-4 font-semibold text-[var(--kinja-green)]">{title}</p><p className="mt-1 max-w-md text-sm text-[#5d685e]">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

const badgeTones = {
  green: "bg-[#e7f6ef] text-[#1f6b45]",
  neutral: "bg-[#e7eee4] text-[#344e41]",
  amber: "bg-[#fff5d9] text-[#8b6818]",
  red: "bg-[#fdf1ef] text-[#9b2c1f]",
  grey: "bg-[#eef1eb] text-[#718074]",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", badgeTones[tone])}>{children}</span>;
}

export type Column<T> = { header: string; cell: (row: T) => React.ReactNode; align?: "right"; className?: string };

export { bodyCell, headCell, tableClass, tableFrame } from "@/components/kinja/table-styles";
import { bodyCell, headCell, tableClass, tableFrame } from "@/components/kinja/table-styles";

// The visible text inside rendered cells, for table search (badges and links included).
function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (typeof node === "object" && "props" in node) return nodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}

export function DataTable<T>({ columns, rows, rowKey, muted, pageSize }: { columns: Array<Column<T>>; rows: T[]; rowKey: (row: T) => string; muted?: (row: T) => boolean; pageSize?: number }) {
  const head = <tr>{columns.map((column, index) => <th className={cn(headCell, column.align === "right" && "text-right")} key={`${column.header}-${index}`} scope="col">{column.header}</th>)}</tr>;
  const body = rows.map((row) => <tr className={cn("group", muted?.(row) && "[&>td]:text-[#a4aea5]")} key={rowKey(row)}>{columns.map((column, index) => <td className={cn(bodyCell, column.align === "right" && "text-right tabular-nums", column.className)} key={`${column.header}-${index}`}>{column.cell(row)}</td>)}</tr>);
  const search = rows.map((row) => columns.map((column) => nodeText(column.cell(row))).join(" ").toLowerCase());
  return <TablePager frameClass={tableFrame} head={head} pageSize={pageSize} rows={body} search={search} tableClass={tableClass} />;
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Tabs between closely related pages, e.g. Customers, Sales and Invoices.
export function SectionTabs({ tabs, active }: { tabs: Array<{ label: string; href: string; count?: number }>; active: string }) {
  return <nav aria-label="Sections" className="mb-8 flex gap-1 overflow-x-auto border-b border-[#dce2d9]">{tabs.map((tab) => <Link aria-current={tab.label === active ? "page" : undefined} className={cn("-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold", tab.label === active ? "border-[var(--kinja-green)] text-[var(--kinja-green)]" : "border-transparent text-[#718074] hover:text-[var(--kinja-green)]")} href={tab.href} key={tab.href}>{tab.label}{tab.count !== undefined && <span className="rounded-full bg-[#eef1eb] px-2 py-0.5 text-xs text-[#5d685e]">{tab.count}</span>}</Link>)}</nav>;
}
