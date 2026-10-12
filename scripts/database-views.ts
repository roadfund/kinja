// Creates (or recreates) the read-only browsing views in scripts/database-views.sql.
// Reads DATABASE_URL from .env.production.local, else .env.local, else the environment.
import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import postgres from "postgres";

for (const file of [".env.production.local", ".env.local"]) { try { loadEnvFile(file); } catch { /* try the next */ } }
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const sql = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
sql.unsafe(readFileSync("scripts/database-views.sql", "utf8"))
  .then(async () => {
    const counts = await sql<Array<{ view: string; rows: number }>>`select 'users' as view, count(*)::int as rows from users union all select 'hubs', count(*)::int from hubs union all select 'organizations', count(*)::int from organizations union all select 'customers', count(*)::int from customers union all select 'orders', count(*)::int from orders union all select 'order_lines', count(*)::int from order_lines union all select 'invoices', count(*)::int from invoices union all select 'payments', count(*)::int from payments union all select 'exchange_rates', count(*)::int from exchange_rates`;
    console.log(counts.map((row) => `${row.view}: ${row.rows}`).join("\n"));
    await sql.end();
  })
  .catch(async (error: Error) => { console.error(error.message); await sql.end(); process.exit(1); });
