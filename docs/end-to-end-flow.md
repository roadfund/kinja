# Kinja: the full flow, from hub to customer

This walks through the whole value chain as it works in Kinja today: who does each step, where in the app, and what gets recorded.

> **Not built yet:** paying farmers (Kinja Pay). The hub's "Kinja Pay" and "Kinja Field" sidebar links, and the cooperative lead's "Payouts" link, open the overview page for now.

## At a glance

| Step | Who | Where | Result |
| --- | --- | --- | --- |
| 1. Start a hub | Company (becomes hub admin) | `/auth/signup`, `/auth/onboarding` | Hub created, pending verification |
| 2. Verify the hub | Tech admin | Hub review (`/admin/hubs`) | Hub verified, modules unlocked |
| 3. Invite the team | Hub admin, then cooperative lead | Team (`/admin/team`) | Cooperative lead, manufacturer, distributor, field staff join |
| 4. Farmers and deliveries | Cooperative lead, field staff | Farmers, Deliveries | Farmers, plots, deliveries with amount owed |
| 5. Raw material to the factory | Cooperative lead, then manufacturer | Transfers | Raw-material transfer, received and checked |
| 6. Production | Manufacturer | Batches, Transfers | Batch with yield; finished goods sent |
| 7. Stock at the distributor | Distributor | Stock, SKUs | Stock on hand per batch and SKU |
| 8. Customer order to cash | Distributor | Customers, Orders, Invoices, Collections | Orders, invoices, payments, PDF invoices and receipts |
| 9. Oversight and reporting | Hub admin, tech admin | Overview, Operations, Moderation | Dashboards, monthly reports, exports, audit trail |

## 1. Start the hub

The company that will run the hub signs itself up. Nobody creates accounts by hand.

- **Sign up** at `/auth/signup` with full name, username, phone, password and an optional email.
- **Enter the business details** at `/auth/onboarding`:
  - business name, category and year established
  - country, region or county, address and optional GPS
  - registration number, certificate upload and optional tax ID
  - contact person
  - main crops, and the approximate number of farmers and cooperatives
- The hub is created as **Pending verification**, and the person who signed up becomes its **hub admin**.
- **While pending**, the hub admin waits at `/auth/pending` but can already set up crops, grades and prices at `/admin/crops`. For example:

  | Crop | Grade | Price per kg |
  | --- | --- | --- |
  | Cassava | Grade A | LRD 6.50 |
  | Cassava | Grade B | LRD 5.00 |
  | Cassava | Rejected | LRD 0.00 |

  Team invites and payouts stay locked until the hub is verified.

## 2. Verify the hub (tech admin)

- **Review**: the tech admin opens **Hub review** (`/admin/hubs`) and verifies or rejects the hub. Every module unlocks once it is verified.
- **Currencies**: the tech admin also manages **Currencies** (`/admin/currencies`). For Liberia that means LRD as the main currency, USD as a second currency, and the exchange rate. Rates are never edited, only replaced, so past amounts never change.

## 3. Build the team by invitation (hub admin)

- **Invite**: under **Team** (`/admin/team/new`), the hub admin invites a **cooperative lead**, a **manufacturer** and a **distributor**.
  - Each invite carries a fixed role and organization (an existing one, or a new one to be named).
  - Kinja sends it by email, or gives a code and link to share anywhere.
  - Invites expire (7 days by default) and can be revoked.
- **Join**: the invitee opens `/auth/invite/[code]`, signs up or logs in, and lands on their dashboard. The invite itself is the approval.
- **Field staff**: the cooperative lead invites field staff the same way from their own **Team** page.

## 4. Farmers and deliveries (Kinja Field)

Done by the cooperative lead and field staff. Both steps work **offline**: records wait on the phone and sync when a connection returns. **Sync status** shows what is still waiting.

- **Register a farmer** under **Farmers**:
  - name, gender, community, phone and mobile money number
  - top 3 crops, each ranked as already grown, currently growing or wanted
  - one or more plots, each with location, size, tenure and the crops on it
  - Kinja warns, but does not block, if the phone number already belongs to another farmer.
- **Record a delivery** under **Deliveries**:
  - farmer, plot (optional), crop, kg and grade, plus a reason if rejected
  - **amount owed = kg × the price for that grade**
  - the price is **locked in** on the delivery, so later price changes never alter it.

## 5. Raw material to the factory

- **Send (cooperative lead)**: under **Transfers**, choose the manufacturer, the crop, the kg sent, and which deliveries the transfer contains.
- **Receive (manufacturer)**: under **Transfers**, confirm the kg actually received.
- **Discrepancy**: if received differs from sent, Kinja flags it to both organizations and the hub admin.

## 6. Production (Kinja Manufacture)

Done by the manufacturer.

- **Create a batch** under **Batches**:
  - choose the received transfers it used
  - set the product (SKU, e.g. SPC_PG80), the quantity produced and the wastage
  - Kinja calculates the **yield**, and numbers the batch B-0001 and so on.
- **Send finished goods** under **Transfers**: choose the distributor, the batch and the quantity.

## 7. Stock at the distributor (Kinja Market)

- **Confirm the shipment** under **Stock**. The goods become stock on hand, per batch.
- **SKUs** shows, for each product: stock on hand, quantities ordered, delivered and cancelled, order value, payment value and average price.

## 8. Customer order to cash

Done by the distributor.

1. **Customers**: add or edit customers, including their payment terms.
2. **New order** (under **Orders**):
   - customer, order date, currency (LRD or USD), category (retail, wholesale or sample) and ordering channel
   - one line per SKU, each with its batch, quantity and price (the last price used is filled in)
   - optional discount and who delivered it
3. **Order status**:
   - saved as **Pending** (stock is reserved) or **Delivered**
   - from the "⋯" menu, **Mark delivered** (date and who), or **Cancel order** with a reason. Cancelling voids the sales and returns the stock.
4. **Invoice** (under **Invoices**): choose delivered sales for one customer, in one currency. Invoices are numbered INV-0001 and so on, with a due date from the customer's payment terms.
5. **Collect**: on the invoice page, record each payment (mobile money, cash or bank transfer, with a reference). The status moves from **Issued** to **Partly paid** to **Paid**, or **Overdue** after the due date.
6. **Documents**: from the "⋯" menu on a sale or invoice, or the buttons on the invoice page, download:
   - the **Invoice PDF**
   - the **Receipt PDF** (numbered RCT-0001 for INV-0001), once at least one payment is recorded.

## 9. Oversight and reporting

- **Hub admin**:
  - the sales dashboard on the overview: orders by status, sales by SKU and by customer category and channel, filterable by month and distributor
  - **Orders**, **SKUs** and **Market** across all distributors
  - **Operations**: impact reporting and monthly reports
  - exports of each table as PDF, Excel or CSV
- **Tech admin**: moderation (suspend users, organizations or hubs; void records with a reason), the audit log, and reports for any hub.

## Money in two currencies

Each order, sale, invoice and payment is recorded in LRD or USD. Every amount is also shown in the other currency, converted at the rate in force on the day it was recorded. Summary cards show one currency each, and tables give each currency its own column.

## Traceability

Every link is stored as an ID, not as text:

**sale → batch → raw-material transfers → deliveries → farmers and plots**

So any finished bag sold to a customer can be traced back to the farmers who grew it. No page shows this chain on screen yet.

## Running a demo

- **Switch accounts**: use the account switcher at `/dev` to move between hub admin, cooperative lead, manufacturer and distributor, and walk the chain in order.
- **Real sales history**: **Import sales history** at `/dev` loads a hub's order spreadsheet (orders, customers, payments and exchange rates). Imported orders keep their own numbers (e.g. JSK0001). The import starts from opening stock, so it skips steps 4 to 6 (farmer deliveries, transfers and production).

## Still to build

- **Kinja Pay**: approve deliveries for payout, and pay farmers by mobile money or record cash payments.
- **Traceability view**: show the path from a sale back to its farmers.
