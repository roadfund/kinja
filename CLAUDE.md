@AGENTS.md

# Kinja

Kinja is a value-chain platform for African agriculture. It records every handoff of a crop from the farmer to the final customer sale, pays farmers through mobile money, and reports on it, so goods, money and impact can be traced end to end. Launch market is Liberia; the product must work in any country through configuration, never hardcoding.

This file is the source of truth for the MVP. If a request conflicts with it, ask before building. When a decision changes, update this file in the same commit.

## Glossary

- **Country**: configuration for a market: currency, default language, time zone, phone format, and enabled mobile money providers.
- **Hub**: one coordinating company and everything it connects: its cooperatives and farmers, manufacturers, distributors, customers, and its rules (crops, grades, prices). Hubs are fully isolated from each other. A hub belongs to one country. Jimmy's Group is the first hub, but never hardcode it.
- **Organization**: a member business inside a hub. Type is `COOPERATIVE`, `MANUFACTURER` or `DISTRIBUTOR`. A hub can have several of each.
- **Invite**: a pre-approved pass into a hub or cooperative, carrying a fixed role and organization. Sent by email or shared as a code and link.
- **Farmer**: a record owned by a cooperative. Farmers never log in.
- **Plot**: a piece of land farmed by a farmer, with its own location, size, tenure and crops. A farmer can have several plots.
- **Customer**: a record owned by the hub.
- **Delivery**: a farmer hands a crop to a cooperative (weighed and graded).
- **Payout**: a payment to a farmer, either sent through mobile money by Kinja (for Liberia: MTN MoMo or Orange Money) or recorded as cash.
- **Transfer**: goods move between two organizations. Sender records quantity sent, receiver confirms quantity received.
- **Batch**: a production run at a manufacturer, linked to the raw-material transfers it used.
- **Order**: a customer order taken by a distributor: one or more SKU lines (each line is a Sale), a customer category (`RETAIL`, `WHOLESALE`, `SAMPLE`), an ordering channel (phone, WhatsApp, team member, office walk-in, other), an optional discount and who delivered it. Status `PENDING`, `DELIVERED` or `CANCELLED`.
- **SKU**: a finished product (Product) as sold by distributors, e.g. a 90 g bag.
- **Sale**: a distributor sells finished goods from a batch to a customer; usually one line of an order.
- **Invoice / Collection**: an invoice is issued for one or more sales; collections are payments received against it.

## Modules (product names)

- **Kinja Field**: cooperatives, farmers, plots, crops, deliveries. Works offline.
- **Kinja Pay**: amounts owed, approvals, mobile money payouts to farmers, reconciliation.
- **Kinja Manufacture**: raw-material reception, batches, finished goods, transfers to distributors.
- **Kinja Market**: customers, sales, invoices, collections.
- **Kinja Ops**: dashboards, discrepancy flags, impact reporting, monthly reports, exports, moderation.

## Auth and onboarding

All auth routes live under `/auth/`. Nobody's account is created by hand: everyone signs up themselves. Hubs are verified by the tech admin; everyone else gets access through an invite.

| Route | Purpose |
| --- | --- |
| `/auth/login` | The single login for every role. Split-screen layout: brand panel on one side, form on the other; on mobile, form only. Username and password. |
| `/auth/signup` | Create an account: full name (required), username (required), phone (required), email (optional), password (required). |
| `/auth/onboarding` | For users who arrive without an invite: start a hub by entering the hub's business details (see Start a hub below). |
| `/auth/invite/[code]` | Invite landing page. Shows who invited the user and to what role and organization, then sends them to sign up or log in and straight to their dashboard. |
| `/auth/pending` | Waiting screen while a hub is being verified. |
| `/auth/reset-password` | Request a reset code by email, then set a new password. |
| `/auth/logout` | End the session. |

Onboarding paths:

1. **Start a hub**: the user enters the hub's details:
   - Business name, business category (agro-processor, cooperative union, exporter or off-taker, development program, other), year established
   - Country, region or county, physical address, GPS location (optional)
   - Business registration number and registration certificate (upload), tax ID (optional)
   - Contact person: full name, title, phone, email
   - Approximate number of farmers and cooperatives it works with (crops are chosen later, in hub setup)
   - Logo and website or social page (optional)

   The hub is created with status `PENDING_VERIFICATION` and the user becomes its hub admin. The hub admin can configure crops, grades and prices while pending, but cannot send invites or run payouts until the tech admin verifies the hub.
2. **Join a hub by invite**: the hub admin opens the Team section and creates an invite for a cooperative lead, manufacturer or distributor, choosing the role and either an existing organization or a new one to be named. Kinja sends the invite by email, or generates a code and link (`/auth/invite/[code]`) the admin can copy and share anywhere. User B clicks the link, signs up or logs in, and is granted access immediately with the role and organization set in the invite. No approval step is needed: the invite is the approval.
3. **Join a cooperative by invite**: the cooperative lead opens the Team section and invites field staff the same way, by email or by a shareable code and link. User B clicks the link, signs up or logs in, and joins the cooperative as field staff immediately.

Invite rules: each invite carries a fixed role and organization that the invitee cannot change. Links are single-use by default; admins can create a multi-use code for onboarding a group, which must have an expiry date. All invites expire (default 7 days) and can be revoked before use. Admins can remove a member at any time.

After login, route each user to their role's dashboard. Hub admins of hubs still pending verification see `/auth/pending` (with access to crop and price setup). Each user has exactly one role in one organization (or one hub) in the MVP.

## Roles

| Role | Scope | Can do |
| --- | --- | --- |
| `TECH_ADMIN` | Whole platform | Verify or reject hubs; manage countries, accepted currencies, exchange rates and the master crop list; see all data; suspend users, organizations and hubs; void or correct records with a logged reason; view impact and monthly reports for any hub |
| `HUB_ADMIN` | One hub | Configure crops, grades and price per kg per grade; invite cooperative leads, manufacturers and distributors from the Team section; revoke invites and remove members; approve deliveries for payout and send payouts; manage customers; view everything in the hub; view impact and monthly reports; export hub data |
| `COOP_LEAD` | One cooperative | Add and edit farmers, plots and crops; record deliveries; invite, revoke and remove field staff from the Team section; review field staff records; see amounts owed and paid; create transfers to a manufacturer; export own data |
| `FIELD_STAFF` | One cooperative | Add farmers, plots and crops; record deliveries (online or offline) |
| `MANUFACTURER` | One manufacturer org | Confirm incoming transfers; create batches; record output and wastage; create transfers to a distributor; export own data |
| `DISTRIBUTOR` | One distributor org | Confirm incoming transfers; manage customers; record sales; issue invoices; record collections; export own data |

## Core flows (MVP)

1. **Hub self-onboarding**: a company signs up, creates a hub with its business details, and waits for tech admin verification. Meanwhile it configures crops from the master list, grades (e.g. A, B, Rejected) and price per kg per grade, in the country's currency.
2. **Team invites**: once verified, the hub admin invites cooperative leads, manufacturers and distributors from the Team section, by email or shareable code and link. Each cooperative lead then invites their field staff the same way. Invitees get access as soon as they accept.
3. **Register farmer** (coop lead or field staff, works offline): name, phone (optional), community, gender, mobile money number (optional), top 3 crops ranked 1 to 3 with status `ALREADY_GROWS`, `CURRENTLY_GROWING` or `WANTS_TO_GROW`. Then one or more plots, each with location, approximate size, tenure (owned, rented, shared) and the crops grown on it. Warn (do not block) if the phone number already exists on another farmer in the hub.
4. **Record delivery** (coop lead or field staff, works offline): farmer, plot (optional), crop, kg, grade, rejection reason if rejected. Amount owed = kg x price for that grade. Snapshot the price on the delivery so later price changes never alter past amounts.
5. **Pay farmer** (hub admin): review unpaid deliveries, approve them, and send a payout to the farmer's mobile money number through the provider for the hub's country. Or record a cash payment with a reference. Payouts are reconciled automatically from provider callbacks. Coop lead sees each payout's status.
6. **Send raw material** (coop lead, then manufacturer): transfer to a chosen manufacturer with crop, kg sent and linked deliveries. Manufacturer confirms kg received.
7. **Produce batch** (manufacturer): select raw-material transfers used, record product, quantity produced and wastage. Compute yield.
8. **Send finished goods** (manufacturer, then distributor): transfer to a chosen distributor with product, batch and quantity. Distributor confirms quantity received.
9. **Sell, invoice, collect** (distributor): record an order (customer, date, category, channel, discount, delivered by, and one line per SKU with batch, quantity and price); each line is a sale. Pending orders hold their stock; cancelling one (with a reason) voids its sales and frees the stock; only delivered orders can be invoiced, at the amount after discount. Issue an invoice for one or more sales with a due date from the customer's payment terms. Record collections (amount, method, reference) against the invoice.
10. **Report and export**: hub admin and tech admin see impact reporting and auto-generated monthly reports. Every role can export the data it owns as CSV or PDF.

## Offline mode (Kinja Field)

- Cooperative leads and field staff can register farmers and plots and record deliveries with no connection. Everything else requires a connection.
- Every Kinja Field write goes through a sync queue with a visible status (e.g. "3 records waiting to sync"). While data lives in localStorage the queue drains locally, but build it as if a server exists, so offline works unchanged when the backend arrives.
- Generate IDs on the device (UUIDv7) so records never need re-keying on sync.
- Cache what offline work needs: the cooperative's farmers, the hub's crops, grades and current prices.
- Sync is idempotent: sending the same record twice must not create a duplicate.
- Conflicts: deliveries are append-only and never conflict. Farmer and plot edits use last write wins, with every version kept in the audit log. Duplicate farmers detected on sync are flagged for the coop lead, not merged automatically.
- Use the price cached on the device when the delivery is recorded, and store it as the snapshot.

## Mobile money payouts (Kinja Pay)

- Payouts go through a provider adapter interface: `initiatePayout`, `getStatus`, `handleCallback`. Each country enables its providers. Start with MTN MoMo and Orange Money for Liberia; the first adapter may wrap Dollr. Adding a country or provider must not change payout logic.
- Payout states: `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `SUCCEEDED`, `FAILED`. Only `SUCCEEDED` marks deliveries as paid.
- Every payout request uses an idempotency key. Never retry a payout without it. Never send money twice for the same deliveries.
- Verify provider callbacks (signature or secret) before trusting them. Poll status for payouts with no callback after a timeout.
- Daily reconciliation compares Kinja payouts with provider records and flags mismatches in Kinja Ops.
- Provider credentials live in environment variables or a secrets store, never in the database in plain text and never in code.
- Use the mock provider adapter until a backend exists, then provider sandboxes in development. Never call live payout APIs from tests.

## Reporting

- **Impact reporting** (hub admin and tech admin), filterable by period and cooperative: farmers reached (farmers with at least one delivery), women participating (count and share of farmers, by gender field), total paid to farmers, average days from delivery to successful payout, local sourcing share (share of raw-material kg traceable to registered farmers), deliveries by crop and grade.
- **Monthly reports**: generated automatically on the 1st of each month for every hub, for the previous month. Four sections: financial (sales, invoiced, collected, paid to farmers), operations (volumes received, yield, wastage, discrepancies), farmers (new registrations, active farmers, deliveries, payouts), sales (by customer and product, overdue invoices). Stored as PDF and CSV, listed in Kinja Ops, and emailed to the hub admin.
- **Exports**: CSV, Excel (.xlsx) and PDF of farmers, deliveries, payouts, stock, orders, sales and invoices. An export contains only what the requesting role can see, with the same filters as the screen.

## Multi-country

- Country table: code, name, main currency, accepted currencies, default language, time zone, phone format, enabled mobile money providers. ExchangeRate and CurrencySetting records hold the tech admin's rates and accepted currencies.
- A hub belongs to one country and inherits its settings. Users see amounts in the hub's currency and times in the hub's time zone.
- All user-facing text goes through translation files. English first; structure must allow French and other languages without code changes.
- Validate phone numbers against the country's format.

## Data layer

Kinja is a production project. **Production data lives in Postgres on Neon** (`DATABASE_URL`). In development, without `DATABASE_URL`, the server stores data in a JSON file under `.data/` through the same localStorage-style adapter. Services and UI never know which store they use.

- All reads and writes go through the `Repository` interface (`src/repositories/`). Implementations: `PostgresRepository` (production; one `kinja_records` table of validated JSON keyed by collection and id, plain SQL through `postgres.js`, no ORM) and `LocalStorageRepository` (development file store; tests use it in memory). `src/repositories/server.ts` picks one; production refuses to start without `DATABASE_URL`.
- Nothing outside the adapter touches `localStorage` directly.
- Keys are namespaced and versioned: `kinja:v1:<collection>`. Store a schema version and write a migration function whenever the stored shape changes.
- Validate every record with Zod on write and on read, so corrupted or outdated data fails loudly.
- Generate IDs with UUIDv7.
- localStorage holds roughly 5 MB per browser. Catch quota errors, warn the user before storage is nearly full, and keep stored records lean.
- Data is per browser: users on other devices cannot see it. For testing every role, add a dev-only account switcher and seed loader. Never ship them in production builds.
- Features that need a backend are simulated behind the same interfaces they will use later:
  - **Email** (invites, resets, monthly reports): a dev outbox screen shows every "sent" email and its link or code.
  - **Payouts**: a mock provider adapter simulates success, failure and delayed callbacks. Never put real provider credentials in the browser.
  - **Monthly reports**: generated when a hub admin or tech admin opens Kinja Ops on or after the 1st, if that month's report is missing.
  - **File uploads** (certificates, logos): stored as data URLs with a strict size cap.

## Domain rules (enforce in code, cover with tests)

- **Hub isolation**: every hub-scoped read and write filters by `hubId` derived from the current session, never from function arguments or form input. A user must never read or write another hub's data.
- **Org scoping**: coop lead, field staff, manufacturer and distributor only see their own organization's records, plus transfers addressed to them.
- **Authorization lives in the service layer**: every service function checks role, scope and membership status before calling a repository. UI components never call repositories directly. Hiding a button is not authorization. When the backend exists, this layer moves to the server unchanged.
- **Unverified hubs**: no invites, no payouts.
- **Invites**: validate the code, expiry, use count and revoked status in the service layer when accepted. The role and organization come from the invite record, never from the client. Hub admins can only invite into their own hub; cooperative leads can only invite field staff into their own cooperative.
- **Transfers have two sides**: `quantitySent` set by sender, `quantityReceived` set by receiver. Status `SENT` then `RECEIVED`. If they differ, set `hasDiscrepancy = true` and surface it to both orgs and the hub admin.
- **Traceability**: a sale must be traceable back through batch, transfers and deliveries to farmers and plots. Keep these links as foreign keys, not text.
- **Money**: integers in minor units. Never floats. Each record stores its own currency, one of its country's accepted currencies (Liberia: LRD main, USD accepted). Orders (and their sales, invoices and collections) can be in any accepted currency; an invoice holds one currency only. Farmer prices, deliveries and payouts are in the main currency for now.
- **Currencies and exchange rates**: the tech admin chooses each country's accepted currencies and sets exchange rates (Platform settings, Currencies). Rates are append-only, never edited. Every amount is shown in every accepted currency, converted at the rate in force on the record's own date, so past figures never change. Summary cards show one currency each (e.g. "Sales value · LRD" and "Sales value · USD"); tables show the recorded amount with the converted ones beneath; exports show "LRD 2,490.00 (USD 13.11)". Monthly report totals are stored in the main currency.
- **Weights**: kg as decimal with fixed precision. Never floats.
- **Orders**: numbered sequentially per hub (`ORD-0001`). Only pending orders can be cancelled. The sales dashboard (distributor and hub overviews) reports orders by status, sales by SKU, quantity by SKU and status, and delivered sales by customer category and channel, filterable by month (and distributor for the hub admin).
- **Invoice and receipt PDFs**: the distributor and hub admin can download a designed invoice for any invoice, and a receipt (`RCT-` + invoice number) once at least one payment is recorded, from the "⋯" menu on sales and invoices or the invoice page. Each shows the amounts in the invoice currency and their equivalent in the other accepted currencies.
- **Invoices**: numbered sequentially per hub. Statuses `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `VOID`. Overdue is computed from the due date.
- **Audit**: every record stores `createdById`, `createdAt`, `updatedAt`. Corrections and voids store who, when and a reason. Never hard-delete deliveries, payouts, transfers, batches, sales, invoices or collections.
- **Crops**: a master list owned by the tech admin; each hub enables a subset. No free-text crop names.
- **Passwords**: never store plain text. Hash with PBKDF2 through Web Crypto for now; switch to argon2 when the backend exists. Rate-limit login, invite acceptance and reset attempts.

## Data model (MVP)

Country, ExchangeRate, CurrencySetting, PayoutProvider, Hub, HubVerification, Crop (master), HubCrop (enabled crop + grades + prices), Grade, Organization, User, Membership (user, role, hub, organization, status), Invite (code, role, hub, organization, invited by, email, max uses, uses, expires at, revoked at), Farmer, FarmerCrop (top 3 ranking), Plot, PlotCrop, Delivery, Payout, PayoutDelivery (join), Transfer, TransferDelivery (join), Batch, BatchTransfer (join), Product, Customer, Order, Sale, Invoice, InvoiceSale (join), Collection, MonthlyReport, ExportJob, SyncLog, AuditLog.

## Out of scope for the MVP

Partner settlement, accounting integrations, lender and investor role, multiple hubs or roles per user, customer ordering portal, Kinja subscription billing, supply forecasting, farmer credit profiles, quality analytics, USSD access, SMS receipts to farmers.

## Tech stack

- Next.js (App Router) with TypeScript in strict mode
- Data layer: typed repository interfaces; Postgres on Neon in production through `postgres.js` (no ORM), a local JSON file in development (see Data layer).
- Auth: custom session handling through an auth service and repository (no Auth.js until the backend exists)
- Tailwind CSS and shadcn/ui
- Zod for validating every input on the server
- PWA with a service worker
- Jobs (payouts, reconciliation, monthly reports, exports) run through a job interface; for now, a client-side runner checks for due jobs when the app opens
- Vitest for unit tests, Playwright for key flows

The app is mobile-first. Cooperative and field staff screens are used on low-end Android phones on slow or missing connections: keep pages light, forms short, tap targets large, and client bundles small.

## Commands

- `pnpm dev`: start the dev server
- `pnpm build`: production build
- `pnpm test`: unit tests (Vitest)
- `pnpm test:watch`: unit tests in watch mode
- `pnpm lint`: ESLint
- `pnpm exec tsc --noEmit`: type-check
- `pnpm test:e2e`: end-to-end tests (Playwright, not set up yet)
- Seed and reset local data from the dev tools panel at `/dev` (development builds only)
- Import real sales history into production with `pnpm import:sheet --sheet "<link>" --hub "<hub name>"` (add `--yes` to write). It reads `DATABASE_URL` from `.env.production.local`, imports into an existing verified hub, creates no user accounts, and only adds orders not already there. Dev tools (`/dev`) are disabled whenever `DATABASE_URL` is set, so they can never wipe the real database.
- Import a hub's real sales history from its order spreadsheet (Google Sheet shared by link) at `/dev`, "Import sales history". It replaces the data with the base demo plus every order, customer, payment and exchange rate from the sheet; imported orders keep their own numbers (e.g. JSK0001) as `reference`. The sheet is fetched at import time and cached in `.data/import` (git-ignored), so real customer data never enters the repo.

## Conventions

- Feature folders by module: `auth`, `team`, `field`, `pay`, `manufacture`, `market`, `ops`, `admin`. Shared layers: `src/data/` (repositories and adapters), `src/services/` (business rules and authorization), `src/domain/` (types and Zod schemas).
- Service functions own all writes: validate with Zod, check permissions, then call the repository.
- One shared `requireRole()` / `getScope()` helper for authorization. Do not reimplement checks inline.
- Dates stored in UTC; display in the hub's time zone.
- Navigation: the sidebar lives in the shared layout (`AppFrame` in `/dashboard` and `/admin` layouts) and highlights from the URL, so pages render content only (`DashboardShell`). Use `Link` for every in-app link (never `<a>`), and change filters with the router instead of form reloads, so moving between tabs never reloads the page. `loading.tsx` shows a skeleton while a page streams in.
- Charts: overviews lead with charts (`src/components/charts`), built as plain HTML on the server with a hover/tap tooltip, no chart library. Green on white only: one green for single measures, a lighter green for pending, red for cancelled. Each chart names its series, labels its bars, shows one currency at a time (Currency filter) and keeps a "View as table".
- Tables: use the shared `DataTable` (or `ReportTable`). One value per column, never two in one cell: amounts get a column per currency (`moneyColumns`), multi-SKU orders a column per SKU, actions go in a "⋯" row menu. Tables scroll sideways with the first column pinned, show 10 rows per page with pages (no infinite scroll), and have a search box once they pass 10 rows.
- Write tests for permissions, hub isolation, invite acceptance (expired, revoked, used up, wrong hub), amount owed, payout idempotency, offline sync idempotency, transfer discrepancies and invoice status before shipping a flow.
- Seed data (loaded into localStorage from the dev tools panel): country Liberia (LRD, English, Africa/Monrovia, MTN MoMo and Orange Money sandbox), one verified hub "Jimmy's Group", crops cassava, sweet potato and plantain with grades A, B, Rejected, one cooperative with farmers and plots, one manufacturer, one distributor, a few customers, one user per role, and a few sample invites (active, expired, revoked). Seed passwords exist only in development builds.
- Never commit secrets. Use `.env` and keep `.env.example` current.

## How to work in this repo

- For anything larger than a small fix, propose a short plan and wait for approval before writing code.
- Build one flow end to end (schema, server logic, UI, tests) before starting the next.
- Keep changes small and commit after each working step with a clear message.
- If the spec is unclear or two rules conflict, stop and ask instead of guessing.
