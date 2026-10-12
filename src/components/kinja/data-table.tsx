import { headers } from "next/headers";
import { bodyCell, headCell, tableClass, tableFrame } from "@/components/kinja/table-styles";
import { TablePager } from "@/components/kinja/table-pager";
import type { Column } from "@/components/kinja/ui";
import { cn } from "@/lib/utils";

// The visible text inside rendered cells, for table search (badges and links included).
function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (typeof node === "object" && "props" in node) return nodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}

// A short stable key per table (from its headers), so several tables on one page page separately.
function tableKey(columns: Array<{ header: string }>): string {
  let hash = 0;
  for (const char of columns.map((column) => column.header).join("|")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `t${hash.toString(36).slice(0, 5)}`;
}

const PAGE_SIZES = [10, 25, 50, 100];

// Pages and search run on the server: only the rows on screen are rendered and sent, so a
// table of 560 orders costs the same as a table of 10. The pager changes the address (e.g.
// ?t1a2b.page=3&t1a2b.q=harbel) and the server renders that slice, without a reload.
export async function DataTable<T>({ columns, rows, rowKey, muted, pageSize = 10, id }: { columns: Array<Column<T>>; rows: T[]; rowKey: (row: T) => string; muted?: (row: T) => boolean; pageSize?: number; id?: string }) {
  const key = id ?? tableKey(columns);
  const params = new URLSearchParams((await headers()).get("x-kinja-search") ?? "");
  const query = (params.get(`${key}.q`) ?? "").trim();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const size = PAGE_SIZES.includes(Number(params.get(`${key}.size`))) ? Number(params.get(`${key}.size`)) : pageSize;
  // Search reads the text each cell shows; it is only worked out when someone searches.
  const matching = words.length ? rows.filter((row) => { const text = columns.map((column) => nodeText(column.cell(row))).join(" ").toLowerCase(); return words.every((word) => text.includes(word)); }) : rows;
  const pages = Math.max(1, Math.ceil(matching.length / size));
  const page = Math.min(Math.max(1, Number(params.get(`${key}.page`)) || 1), pages);
  const shown = matching.slice((page - 1) * size, page * size);
  const head = <tr>{columns.map((column, index) => <th className={cn(headCell, column.align === "right" && "text-right")} key={`${column.header}-${index}`} scope="col">{column.header}</th>)}</tr>;
  const body = shown.map((row) => <tr className={cn("group", muted?.(row) && "[&>td]:text-[#a4aea5]")} key={rowKey(row)}>{columns.map((column, index) => <td className={cn(bodyCell, column.align === "right" && "text-right tabular-nums", column.className)} key={`${column.header}-${index}`}>{column.cell(row)}</td>)}</tr>);
  return <TablePager frameClass={tableFrame} head={head} initialSize={pageSize} page={page} pages={pages} query={query} rows={body} size={size} tableClass={tableClass} tableKey={key} total={rows.length} matches={matching.length} />;
}
