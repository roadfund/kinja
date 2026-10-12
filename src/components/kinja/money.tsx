import { SummaryCard, type Column } from "@/components/kinja/ui";
import { formatIn, moneyLines, type MoneyContext, type MoneyItem } from "@/domain/currency";
import { cn } from "@/lib/utils";

// An amount in every currency of the hub's country: the first line is the recorded (or main)
// currency, the others are converted at the rate in force on each record's date.
// No hooks, so server pages and client forms can both use it.
export function Money({ context, value, className, strong = false }: { context: MoneyContext; value: MoneyItem | MoneyItem[]; className?: string; strong?: boolean }) {
  const [first, ...rest] = moneyLines(context, value);
  return <span className={cn("inline-block whitespace-nowrap", className)}><span className={cn(strong && "font-semibold text-[var(--kinja-green)]")}>{first.text}</span>{rest.map((line) => <span className="block text-xs font-normal text-[#718074]" key={line.currency}>{line.text}</span>)}</span>;
}

// One summary card per currency, e.g. "Sales value · LRD" and "Sales value · USD", each with the
// full total converted into that currency. The main currency always comes first.
export function MoneyCards({ context, value, label, detail, tone }: { context: MoneyContext; value: MoneyItem | MoneyItem[]; label: string; detail: React.ReactNode | ((currency: string) => React.ReactNode); tone?: "warning" }) {
  const lines = moneyLines({ ...context }, Array.isArray(value) && value.length === 0 ? [] : value);
  const ordered = [...context.currencies.flatMap((code) => lines.filter((line) => line.currency === code)), ...lines.filter((line) => !context.currencies.includes(line.currency))];
  return <>{ordered.map((line) => <SummaryCard detail={typeof detail === "function" ? detail(line.currency) : detail} key={line.currency} label={`${label} · ${line.currency}`} tone={tone} value={line.text} />)}</>;
}

type MoneyValue = MoneyItem | MoneyItem[] | null | undefined;
const asItems = (value: MoneyValue) => (value ? (Array.isArray(value) ? value : [value]) : null);

// Table columns for an amount: one per currency of the country, e.g. "Amount (LRD)" and "Amount (USD)".
// Tables never stack two values in one cell.
export function moneyColumns<T>(context: MoneyContext, header: string, value: (row: T) => MoneyValue, { strong = false }: { strong?: boolean } = {}): Array<Column<T>> {
  return context.currencies.map((currency) => ({
    header: `${header} (${currency})`,
    align: "right" as const,
    cell: (row: T) => {
      const items = asItems(value(row));
      if (!items) return "—";
      const text = formatIn(context, items, currency);
      return strong ? <span className="font-semibold text-[var(--kinja-green)]">{text}</span> : text;
    },
  }));
}

// The same for report tables built from header and cell arrays.
export const moneyHeaders = (context: MoneyContext, header: string) => context.currencies.map((currency) => `${header} (${currency})`);
export const moneyCells = (context: MoneyContext, value: MoneyValue) => context.currencies.map((currency) => { const items = asItems(value); return items ? formatIn(context, items, currency) : "—"; });
