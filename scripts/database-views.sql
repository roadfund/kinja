-- Read-only views over kinja_records, so each kind of record can be browsed like a table
-- (Neon's Tables page, or any SQL client). Kinja itself reads and writes only kinja_records.
-- Amounts are shown in currency units (minor units / 100); password hashes and session
-- tokens are never exposed. Recreate with: pnpm db:views

drop view if exists users, hubs, organizations, memberships, customers, orders, order_lines, invoices, payments, products, batches, transfers, farmers, deliveries, exchange_rates;

create view users as
select u.id, u.data->>'fullName' as full_name, u.data->>'username' as username, u.data->>'phone' as phone, u.data->>'email' as email,
       (u.data->>'createdAt')::timestamptz as created_at
from kinja_records u where u.entity = 'User';

create view hubs as
select h.id, h.data->>'businessName' as business_name, h.data->>'status' as status, h.data->>'countryId' as country, h.data->>'regionOrCounty' as region,
       h.data->>'physicalAddress' as address, h.data->>'businessCategory' as category, h.data->>'businessRegistrationNumber' as registration_number,
       h.data->'contactPerson'->>'fullName' as contact_name, h.data->'contactPerson'->>'phone' as contact_phone, h.data->'contactPerson'->>'email' as contact_email,
       (h.data->>'createdAt')::timestamptz as created_at
from kinja_records h where h.entity = 'Hub';

create view organizations as
select o.id, o.data->>'name' as name, o.data->>'type' as type, hub.data->>'businessName' as hub, o.data->>'suspendedAt' as suspended_at,
       (o.data->>'createdAt')::timestamptz as created_at
from kinja_records o left join kinja_records hub on hub.entity = 'Hub' and hub.id = o.hub_id
where o.entity = 'Organization';

create view memberships as
select m.id, u.data->>'fullName' as person, u.data->>'username' as username, m.data->>'role' as role, m.data->>'status' as status,
       coalesce(org.data->>'name', hub.data->>'businessName', 'Kinja platform') as organization, hub.data->>'businessName' as hub,
       (m.data->>'createdAt')::timestamptz as joined_at
from kinja_records m
left join kinja_records u on u.entity = 'User' and u.id = m.data->>'userId'
left join kinja_records org on org.entity = 'Organization' and org.id = m.data->>'organizationId'
left join kinja_records hub on hub.entity = 'Hub' and hub.id = m.hub_id
where m.entity = 'Membership';

create view customers as
select c.id, c.data->>'name' as name, c.data->>'phone' as phone, c.data->>'email' as email, c.data->>'address' as address,
       (c.data->>'paymentTermsDays')::int as payment_terms_days, c.data->>'archivedAt' as archived_at, hub.data->>'businessName' as hub,
       (c.data->>'createdAt')::timestamptz as created_at
from kinja_records c left join kinja_records hub on hub.entity = 'Hub' and hub.id = c.hub_id
where c.entity = 'Customer';

create view orders as
select o.id, coalesce(o.data->>'reference', 'ORD-' || lpad(o.data->>'number', 4, '0')) as order_number, (o.data->>'orderedOn')::date as ordered_on,
       o.data->>'status' as status, c.data->>'name' as customer, o.data->>'category' as category, o.data->>'channel' as channel, o.data->>'currency' as currency,
       (select round(sum((s.data->>'amountMinor')::numeric) / 100, 2) from kinja_records s where s.entity = 'Sale' and s.data->>'orderId' = o.id) as order_value,
       (select round(sum((s.data->>'amountMinor')::numeric - coalesce((s.data->>'discountMinor')::numeric, 0)) / 100, 2) from kinja_records s where s.entity = 'Sale' and s.data->>'orderId' = o.id) as payment_value,
       round((o.data->>'discountBasisPoints')::numeric / 100, 2) as discount_percent, o.data->>'deliveredBy' as delivered_by, (o.data->>'deliveredOn')::date as delivered_on,
       o.data->>'cancelReason' as cancel_reason, dist.data->>'name' as distributor, hub.data->>'businessName' as hub
from kinja_records o
left join kinja_records c on c.entity = 'Customer' and c.id = o.data->>'customerId'
left join kinja_records dist on dist.entity = 'Organization' and dist.id = o.data->>'distributorId'
left join kinja_records hub on hub.entity = 'Hub' and hub.id = o.hub_id
where o.entity = 'Order';

create view order_lines as
select s.id, coalesce(o.data->>'reference', 'ORD-' || lpad(o.data->>'number', 4, '0')) as order_number, (s.data->>'soldAt')::timestamptz as sold_at,
       c.data->>'name' as customer, p.data->>'name' as product, 'B-' || lpad(b.data->>'number', 4, '0') as batch,
       (s.data->>'quantity')::numeric as quantity, s.data->>'currency' as currency, round((s.data->>'unitPriceMinor')::numeric / 100, 2) as unit_price,
       round((s.data->>'amountMinor')::numeric / 100, 2) as amount, round(coalesce((s.data->>'discountMinor')::numeric, 0) / 100, 2) as discount,
       round(((s.data->>'amountMinor')::numeric - coalesce((s.data->>'discountMinor')::numeric, 0)) / 100, 2) as amount_due,
       'INV-' || lpad(i.data->>'number', 4, '0') as invoice, s.data->>'voidedAt' as voided_at, s.data->>'voidReason' as void_reason
from kinja_records s
left join kinja_records o on o.entity = 'Order' and o.id = s.data->>'orderId'
left join kinja_records c on c.entity = 'Customer' and c.id = s.data->>'customerId'
left join kinja_records p on p.entity = 'Product' and p.id = s.data->>'productId'
left join kinja_records b on b.entity = 'Batch' and b.id = s.data->>'batchId'
left join kinja_records i on i.entity = 'Invoice' and i.id = s.data->>'invoiceId'
where s.entity = 'Sale';

create view invoices as
select i.id, 'INV-' || lpad(i.data->>'number', 4, '0') as invoice_number, c.data->>'name' as customer, i.data->>'currency' as currency,
       round((i.data->>'totalMinor')::numeric / 100, 2) as total,
       round(coalesce((select sum((p.data->>'amountMinor')::numeric) from kinja_records p where p.entity = 'Collection' and p.data->>'invoiceId' = i.id and p.data->>'voidedAt' is null), 0) / 100, 2) as paid,
       round(((i.data->>'totalMinor')::numeric - coalesce((select sum((p.data->>'amountMinor')::numeric) from kinja_records p where p.entity = 'Collection' and p.data->>'invoiceId' = i.id and p.data->>'voidedAt' is null), 0)) / 100, 2) as outstanding,
       (i.data->>'issuedAt')::timestamptz as issued_at, (i.data->>'dueDate')::date as due_date, i.data->>'voidedAt' as voided_at
from kinja_records i left join kinja_records c on c.entity = 'Customer' and c.id = i.data->>'customerId'
where i.entity = 'Invoice';

create view payments as
select p.id, 'INV-' || lpad(i.data->>'number', 4, '0') as invoice_number, c.data->>'name' as customer, i.data->>'currency' as currency,
       round((p.data->>'amountMinor')::numeric / 100, 2) as amount, p.data->>'method' as method, p.data->>'reference' as reference,
       (p.data->>'receivedAt')::timestamptz as received_at, p.data->>'voidedAt' as voided_at
from kinja_records p
left join kinja_records i on i.entity = 'Invoice' and i.id = p.data->>'invoiceId'
left join kinja_records c on c.entity = 'Customer' and c.id = i.data->>'customerId'
where p.entity = 'Collection';

create view products as
select p.id, p.data->>'name' as name, p.data->>'unit' as unit, org.data->>'name' as manufacturer, (p.data->>'createdAt')::timestamptz as created_at
from kinja_records p left join kinja_records org on org.entity = 'Organization' and org.id = p.data->>'organizationId'
where p.entity = 'Product';

create view batches as
select b.id, 'B-' || lpad(b.data->>'number', 4, '0') as batch, p.data->>'name' as product, (b.data->>'quantityProduced')::numeric as quantity_produced,
       (b.data->>'inputKg')::numeric as input_kg, (b.data->>'wastageKg')::numeric as wastage_kg, org.data->>'name' as manufacturer,
       (b.data->>'producedAt')::timestamptz as produced_at, b.data->>'voidedAt' as voided_at
from kinja_records b
left join kinja_records p on p.entity = 'Product' and p.id = b.data->>'productId'
left join kinja_records org on org.entity = 'Organization' and org.id = b.data->>'organizationId'
where b.entity = 'Batch';

create view transfers as
select t.id, t.data->>'kind' as kind, f.data->>'name' as from_organization, d.data->>'name' as to_organization, coalesce(p.data->>'name', t.data->>'cropId') as goods,
       t.data->>'unit' as unit, (t.data->>'quantitySent')::numeric as quantity_sent, (t.data->>'quantityReceived')::numeric as quantity_received,
       t.data->>'status' as status, (t.data->>'hasDiscrepancy')::boolean as has_discrepancy, t.data->>'note' as note,
       (t.data->>'createdAt')::timestamptz as sent_at, (t.data->>'receivedAt')::timestamptz as received_at, t.data->>'voidedAt' as voided_at
from kinja_records t
left join kinja_records f on f.entity = 'Organization' and f.id = t.data->>'fromOrganizationId'
left join kinja_records d on d.entity = 'Organization' and d.id = t.data->>'toOrganizationId'
left join kinja_records p on p.entity = 'Product' and p.id = t.data->>'productId'
where t.entity = 'Transfer';

create view farmers as
select f.id, f.data->>'fullName' as full_name, f.data->>'gender' as gender, (f.data->>'age')::int as age, f.data->>'community' as community,
       f.data->>'phone' as phone, f.data->>'mobileMoneyNumber' as mobile_money, jsonb_array_length(coalesce(f.data->'plots', '[]'::jsonb)) as plots,
       coop.data->>'name' as cooperative, (f.data->>'createdAt')::timestamptz as registered_at
from kinja_records f left join kinja_records coop on coop.entity = 'Organization' and coop.id = f.data->>'cooperativeId'
where f.entity = 'Farmer';

create view deliveries as
select d.id, (d.data->>'createdAt')::timestamptz as delivered_at, f.data->>'fullName' as farmer, d.data->>'cropId' as crop, d.data->>'gradeId' as grade,
       (d.data->>'kilograms')::numeric as kilograms, round((d.data->>'priceMinorPerKg')::numeric / 100, 2) as price_per_kg,
       round((d.data->>'amountOwedMinor')::numeric / 100, 2) as amount_owed, d.data->>'rejectionReason' as rejection_reason,
       coop.data->>'name' as cooperative, d.data->>'voidedAt' as voided_at
from kinja_records d
left join kinja_records f on f.entity = 'Farmer' and f.id = d.data->>'farmerId'
left join kinja_records coop on coop.entity = 'Organization' and coop.id = d.data->>'cooperativeId'
where d.entity = 'Delivery';

create view exchange_rates as
select r.id, r.data->>'countryId' as country, r.data->>'currency' as currency, round((r.data->>'rateTenThousandths')::numeric / 10000, 4) as rate,
       (r.data->>'effectiveFrom')::timestamptz as effective_from
from kinja_records r where r.entity = 'ExchangeRate';
