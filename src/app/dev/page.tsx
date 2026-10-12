import { Database, ExternalLink, FileSpreadsheet, LogIn, Mail, RotateCcw, Sprout, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentAccount } from "@/auth/route-authorization";
import { PLATFORM_HUB_ID } from "@/auth/server-store";
import { roleLabels } from "@/domain/person";
import { devToolsEnabled } from "@/dev/guard";
import { seedIfFresh } from "@/dev/seed";
import { listOutbox } from "@/email/outbox";
import { getRepository } from "@/repositories/server";

const notices: Record<string, string> = { seeded: "Demo data loaded. Every role below can be signed in.", cleared: "All data cleared. Load demo data to get accounts back." };

export default async function DevToolsPage({ searchParams }: { searchParams: Promise<{ done?: string; orders?: string; customers?: string; invoices?: string; from?: string; to?: string; cached?: string; skipped?: string; error?: string }> }) {
  if (!devToolsEnabled) notFound();
  await seedIfFresh();
  const query = await searchParams;
  const { done } = query;
  const repository = getRepository();
  const [users, memberships, hubs, organizations, emails, current] = await Promise.all([repository.list("User"), repository.list("Membership"), repository.list("Hub"), repository.list("Organization"), listOutbox(), getCurrentAccount()]);
  const hubName = (hubId: string) => (hubId === PLATFORM_HUB_ID ? "Kinja platform" : hubs.find((hub) => hub.id === hubId)?.businessName ?? hubId);
  const accounts = users.map((user) => ({ user, membership: memberships.find((item) => item.userId === user.id && item.status === "ACTIVE") }));
  const counts = await Promise.all(([["Hub", "Hubs"], ["User", "Users"], ["Farmer", "Farmers"], ["Delivery", "Deliveries"], ["Invite", "Invites"], ["Session", "Sessions"]] as const).map(async ([entity, label]) => [label, (await repository.list(entity)).length] as const));

  return <main className="min-h-screen bg-[var(--kinja-cream)] px-4 py-8 sm:px-10">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Wrench size={18} aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Development only</p><h1 className="text-2xl font-semibold text-primary">Dev tools</h1></div></div>
      {current ? <p className="text-sm text-muted-foreground">Signed in as <span className="font-semibold text-primary">{current.user.fullName}</span></p> : <p className="text-sm text-muted-foreground">Not signed in</p>}
    </header>
    {done && notices[done] && <p className="mt-6 rounded-xl border border-[#cce8d5] bg-[#f1fbf3] px-4 py-3 text-sm text-[#1f6b45]" role="status">{notices[done]}</p>}
    {done === "imported" && <p className="mt-6 rounded-xl border border-[#cce8d5] bg-[#f1fbf3] px-4 py-3 text-sm text-[#1f6b45]" role="status">Imported {query.orders} orders from {query.from} to {query.to}, {query.customers} customers and {query.invoices} invoices{query.cached ? " (from the saved copy: the sheet could not be reached)" : ""}. Sign in as the distributor or hub admin to see the dashboards.{query.skipped ? ` Skipped: ${query.skipped}.` : ""}</p>}
    {done === "import-failed" && <p className="mt-6 rounded-xl border border-[#f3c7c2] bg-[#fdf1ef] px-4 py-3 text-sm text-[#9b2c1f]" role="alert">Import failed: {query.error}</p>}

    <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_2fr]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Database size={16} aria-hidden="true" />Data</CardTitle><CardDescription>Stored in <code>.data/kinja.json</code>. Survives restarts.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-3 gap-3">{counts.map(([label, count]) => <div className="rounded-lg bg-muted p-3" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold text-primary">{count}</dd></div>)}</dl>
          <div className="flex flex-wrap gap-2">
            <form action="/dev/seed" method="post"><Button size="lg" type="submit"><Sprout aria-hidden="true" />Load demo data</Button></form>
            <form action="/dev/reset" method="post"><Button size="lg" variant="destructive" type="submit"><Trash2 aria-hidden="true" />Clear all data</Button></form>
          </div>
          <p className="text-xs text-muted-foreground">Loading demo data replaces everything but keeps demo users signed in. Clearing signs everyone out. Demo passwords come from <code>.env.local</code>, or <code>kinja-dev-password</code> when unset.</p>
        </CardContent>
      </Card>

      <Card className="lg:order-last lg:col-span-2">
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet size={16} aria-hidden="true" />Import sales history</CardTitle><CardDescription>Loads the demo people and supply chain, then every order, customer, payment and exchange rate from the hub&apos;s order spreadsheet. The sheet must be shared as &quot;Anyone with the link&quot;. A copy is saved in <code>.data/import</code> for offline use.</CardDescription></CardHeader>
        <CardContent>
          <form action="/dev/import" className="flex flex-wrap gap-2" method="post"><input className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm" defaultValue={process.env.KINJA_IMPORT_SHEET_URL ?? ""} name="sheet" placeholder="https://docs.google.com/spreadsheets/d/…" required /><Button size="lg" type="submit"><FileSpreadsheet aria-hidden="true" />Replace data with this sheet</Button></form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw size={16} aria-hidden="true" />Switch account</CardTitle><CardDescription>Sign in as anyone without a password.</CardDescription></CardHeader>
        <CardContent>
          {accounts.length === 0 ? <p className="text-sm text-muted-foreground">No accounts. Load demo data first.</p> : <Table>
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Username</TableHead><TableHead>Role</TableHead><TableHead>Hub</TableHead><TableHead>Organization</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{accounts.map(({ user, membership }) => <TableRow key={user.id}>
              <TableCell><span className="flex items-center gap-2"><Avatar className="h-7 w-7" name={user.fullName} photoUrl={user.photoUrl} seed={user.id} /><span className="font-medium text-primary">{user.fullName}</span></span></TableCell>
              <TableCell className="text-muted-foreground">{user.username}</TableCell>
              <TableCell>{membership ? <Badge variant="secondary">{roleLabels[membership.role]}</Badge> : <Badge variant="outline">No membership</Badge>}</TableCell>
              <TableCell className="text-muted-foreground">{membership ? hubName(membership.hubId) : "—"}{membership && hubs.find((hub) => hub.id === membership.hubId)?.status === "PENDING_VERIFICATION" && <Badge className="ml-2" variant="outline">Pending</Badge>}</TableCell>
              <TableCell className="text-muted-foreground">{organizations.find((item) => item.id === membership?.organizationId)?.name ?? "—"}</TableCell>
              <TableCell className="text-right"><form action="/dev/switch" method="post"><input name="userId" type="hidden" value={user.id} /><Button size="sm" variant={current?.user.id === user.id ? "secondary" : "outline"} type="submit"><LogIn aria-hidden="true" />{current?.user.id === user.id ? "Current" : "Sign in"}</Button></form></TableCell>
            </TableRow>)}</TableBody>
          </Table>}
        </CardContent>
      </Card>
    </div>

    <Card className="mt-4">
      <CardHeader><CardTitle className="flex items-center gap-2"><Mail size={16} aria-hidden="true" />Email outbox</CardTitle><CardDescription>Every email Kinja would have sent. No real emails go out yet.</CardDescription></CardHeader>
      <CardContent>
        {emails.length === 0 ? <p className="text-sm text-muted-foreground">No emails yet. Try <Link className="font-medium text-primary underline" href="/auth/reset-password">resetting a password</Link>.</p> : <ul className="divide-y divide-border">{emails.map((email) => <li className="py-4" key={email.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold text-primary">{email.subject}</p><time className="text-xs text-muted-foreground" dateTime={email.createdAt}>{new Date(email.createdAt).toLocaleString("en-GB")}</time></div>
          <p className="text-sm text-muted-foreground">To {email.to}</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-sm text-foreground">{email.text}</pre>
          {email.link && <a className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary underline" href={email.link}>Open link<ExternalLink size={13} aria-hidden="true" /></a>}
        </li>)}</ul>}
      </CardContent>
    </Card>
  </main>;
}
