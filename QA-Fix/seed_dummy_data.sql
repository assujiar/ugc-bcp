-- ============================================================================
-- UGC Integrated Dashboard – Seed Data for QA Remediation
--
-- This script inserts minimal yet comprehensive test data to exercise all
-- modules (KPI, CRM, Ticketing, DSO) and to populate 15 roles so that the
-- smoke‑test matrix can be executed.  It is intended to be run after the
-- baseline migrations and the incremental patch contained in `PATCHES.sql`.
-- Adjust UUIDs and dates as necessary for your environment.
--
-- NOTE: Many tables use triggers and helper functions (e.g. next_prefixed_id,
-- find_or_create_customer, crm_create_lead_bundle).  Where appropriate
-- this script calls those functions rather than inserting directly.  The
-- `auth.uid()` within functions will resolve to the user configured by
-- Supabase’s JWT claims.  When running this script manually, you can set
-- `request.jwt.claim.sub` and `request.jwt.claim.role` to impersonate a user
-- (see RLS_SMOKE_TEST.sql for examples).
--
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Roles and Users
--
-- The `roles` table is populated by the baseline seed.  Here we insert one
-- profile (user) per role.  UUIDs are generated via Postgres’ `gen_random_uuid()`
-- but can be replaced with fixed values if deterministic behaviour is needed.
-- The department codes follow the blueprint (MKT = Marketing, SAL = Sales,
-- FIN = Finance, EXI/DOM/IMP/TRA = Ops departments, DIR = Director).
--
-- Passwords are hashed by Supabase during sign‑up; here we store plain text
-- placeholders for convenience.  In a real environment you should sign up via
-- Supabase auth rather than inserting into `profiles` directly.
-- -----------------------------------------------------------------------------

insert into profiles (user_id, user_code, email, password, full_name, role_name, dept_code, manager_user_id)
values
  (gen_random_uuid(), 'USR100', 'director@test.ugc', 'Test123!', 'Dir QA', 'Director', 'DIR', null),
  (gen_random_uuid(), 'USR101', 'admin@test.ugc', 'Test123!', 'Admin QA', 'super admin', 'DIR', null),
  (gen_random_uuid(), 'USR102', 'mktmgr@test.ugc', 'Test123!', 'Marketing Manager QA', 'Marketing Manager', 'MKT', null),
  (gen_random_uuid(), 'USR103', 'marcomm@test.ugc', 'Test123!', 'Marcomm QA', 'Marcomm (marketing staff)', 'MKT', null),
  (gen_random_uuid(), 'USR104', 'dgo@test.ugc', 'Test123!', 'DGO QA', 'DGO (Marketing staff)', 'MKT', null),
  (gen_random_uuid(), 'USR105', 'macx@test.ugc', 'Test123!', 'MACX QA', 'MACX (marketing staff)', 'MKT', null),
  (gen_random_uuid(), 'USR106', 'vsdo@test.ugc', 'Test123!', 'VSDO QA', 'VSDO (marketing staff)', 'MKT', null),
  (gen_random_uuid(), 'USR107', 'salesmgr@test.ugc', 'Test123!', 'Sales Manager QA', 'sales manager', 'SAL', null),
  (gen_random_uuid(), 'USR108', 'sales@test.ugc', 'Test123!', 'Salesperson QA', 'salesperson', 'SAL', null),
  (gen_random_uuid(), 'USR109', 'salessupport@test.ugc', 'Test123!', 'Sales Support QA', 'sales support', 'SAL', null),
  (gen_random_uuid(), 'USR110', 'eximops@test.ugc', 'Test123!', 'EXIM Ops QA', 'EXIM Ops (operation)', 'EXI', null),
  (gen_random_uuid(), 'USR111', 'domops@test.ugc', 'Test123!', 'Domestic Ops QA', 'domestics Ops (operation)', 'DOM', null),
  (gen_random_uuid(), 'USR112', 'importops@test.ugc', 'Test123!', 'Import DTD Ops QA', 'Import DTD Ops (operation)', 'IMP', null),
  (gen_random_uuid(), 'USR113', 'trafficops@test.ugc', 'Test123!', 'Traffic & Warehouse QA', 'traffic & warehous (operation)', 'TRA', null),
  (gen_random_uuid(), 'USR114', 'finance@test.ugc', 'Test123!', 'Finance QA', 'finance', 'FIN', null)
on conflict (email) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Customers
--
-- Insert a few customers to drive the CRM and DSO flows.  The `customers`
-- table includes a natural primary key `customer_id` (string), so we use
-- prefixed IDs for realism.  Created_by references one of the users above.
-- -----------------------------------------------------------------------------

insert into customers (customer_id, company_name, pic_name, pic_phone, pic_email, created_by)
values
  ('CUST00001', 'PT Sumber Rejeki', 'Andi Wijaya', '08123456789', 'andi@sumber.com', (select user_id from profiles where email = 'finance@test.ugc')),
  ('CUST00002', 'CV Lautan Mas', 'Budi Hartono', '08987654321', 'budi@lautanmas.com', (select user_id from profiles where email = 'sales@test.ugc')),
  ('CUST00003', 'UD Angkasa Raya', 'Citra Dewi', '082233445566', 'citra@angkasa.co.id', (select user_id from profiles where email = 'salesmgr@test.ugc'))
on conflict (customer_id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Leads and CRM funnel
--
-- Use the supplied RPC `crm_create_lead_bundle` to create leads and associated
-- prospects/customers without duplicating data.  For demonstration we create
-- three leads, one of which is linked to an existing customer, another that
-- results in a new customer, and one flagged as RFQ to generate a ticket.
-- -----------------------------------------------------------------------------

-- Lead 1: new lead, becomes customer CUST00004 via dedup
select * from crm_create_lead_bundle(jsonb_build_object(
  'company_name', 'PT Maju Mundur',
  'pic_name', 'Dian',
  'contact_phone', '0817000000',
  'email', 'dian@maju.com',
  'city_area', 'Jakarta',
  'service_code', 'TRUK',
  'sourced_by', 'website',
  'primary_channel', 'organic',
  'notes', 'New potential customer',
  'need_rfq', false
));

-- Lead 2: attach to existing customer CUST00001
select * from crm_create_lead_bundle(jsonb_build_object(
  'customer_id', 'CUST00001',
  'company_name', 'PT Sumber Rejeki',
  'pic_name', 'Andi Wijaya',
  'contact_phone', '08123456789',
  'email', 'andi@sumber.com',
  'city_area', 'Jakarta',
  'service_code', 'SEA',
  'sourced_by', 'event',
  'primary_channel', 'exhibition',
  'notes', 'Cross‑sell opportunity',
  'need_rfq', true,
  'rfq_dept_target', 'EXI'
));

-- Lead 3: disqualified lead (will not convert)
select * from crm_create_lead_bundle(jsonb_build_object(
  'company_name', 'PT Tidak Jadi',
  'pic_name', 'Eka',
  'contact_phone', '0819999999',
  'email', 'eka@tidakjadi.id',
  'city_area', 'Bandung',
  'service_code', 'AIR',
  'sourced_by', 'ads',
  'primary_channel', 'paid',
  'notes', 'Budget not approved',
  'status', 'Disqualified'
));

-- -----------------------------------------------------------------------------
-- 4. Tickets and SLA events
--
-- Create two tickets: one general ticket and one inquiry tariff (RFQ).  Then
-- insert messages to trigger `FIRST_RESPONSE` and update the status to
-- generate `STATUS_CHANGE` and `RESOLVED` events via triggers.  The user
-- context is controlled via the session; ensure `request.jwt.claim.sub` is set
-- appropriately when running these inserts so that triggers record the correct
-- `created_by` values.
-- -----------------------------------------------------------------------------

-- Ticket 1: general support ticket
insert into tickets (ticket_type, ticket_status, dept_target, subject, description, created_by)
values ('general', 'OPEN', 'SAL', 'Missing POD', 'Customer cannot find proof of delivery', (select user_id from profiles where email = 'sales@test.ugc'))
returning ticket_id into _ticket1;

-- Respond to ticket 1 (triggers FIRST_RESPONSE)
insert into ticket_messages (ticket_id, message_text, created_by)
values (_ticket1, 'We are investigating the missing POD and will revert shortly.', (select user_id from profiles where email = 'salessupport@test.ugc'));

-- Close ticket 1 to trigger STATUS_CHANGE and RESOLVED
update tickets set ticket_status = 'CLOSED' where ticket_id = _ticket1;

-- Ticket 2: RFQ from lead 2 (already created by crm_create_lead_bundle)
-- Find the ticket created for lead 2 and reply
with lead_ticket as (
  select ticket_id from tickets where related_lead_id = (select lead_id from leads where company_name = 'PT Sumber Rejeki' order by created_at desc limit 1)
)
insert into ticket_messages (ticket_id, message_text, created_by)
select ticket_id, 'Here is our best rate for your ocean shipment.', (select user_id from profiles where email = 'eximops@test.ugc')
from lead_ticket;

-- Update RFQ ticket status to CLOSED LOST with close_reason
update tickets set inquiry_status = 'CLOSED LOST', close_reason = 'Customer chose competitor' where ticket_id in (select ticket_id from lead_ticket);

-- -----------------------------------------------------------------------------
-- 5. Invoices and payments (DSO)
--
-- Use the RPC `finance_create_invoice_with_payment` to insert invoices and
-- optional payments in a single transaction.  Three scenarios:
--   • Invoice A: fully paid on creation
--   • Invoice B: partially paid (status WAITING_PAYMENT)
--   • Invoice C: unpaid and overdue
-- -----------------------------------------------------------------------------

-- Invoice A: fully paid (status = PAID)
select * from finance_create_invoice_with_payment(jsonb_build_object(
  'customer_id', 'CUST00001',
  'invoice_date', current_date - 10,
  'due_date', current_date + 20,
  'invoice_amount', 5000000,
  'currency', 'IDR',
  'payment_amount', 5000000,
  'payment_date', current_date,
  'payment_method', 'transfer',
  'payment_reference', 'VA12345'
));

-- Invoice B: partially paid (status = WAITING_PAYMENT)
select * from finance_create_invoice_with_payment(jsonb_build_object(
  'customer_id', 'CUST00002',
  'invoice_date', current_date - 30,
  'due_date', current_date - 5,
  'invoice_amount', 8000000,
  'currency', 'IDR',
  'payment_amount', 3000000,
  'payment_date', current_date - 2,
  'payment_method', 'credit_card',
  'payment_reference', 'CC98765'
));

-- Invoice C: no payment yet and overdue (status = CREATED)
select * from finance_create_invoice_with_payment(jsonb_build_object(
  'customer_id', 'CUST00003',
  'invoice_date', current_date - 60,
  'due_date', current_date - 30,
  'invoice_amount', 12000000,
  'currency', 'IDR'
));

-- Record an additional payment towards Invoice B to test status transition to PAID
do $$
declare
  inv_id text;
begin
  select invoice_id into inv_id from invoices
  where customer_id = 'CUST00002' order by created_at desc limit 1;
  insert into payments (invoice_id, payment_date, amount, payment_method, reference_no, created_by)
  values (inv_id, current_date, 5000000, 'transfer', 'VA67890', (select user_id from profiles where email = 'finance@test.ugc'));
end $$;

-- -----------------------------------------------------------------------------
-- 6. KPI metrics and targets
--
-- Insert sample KPI definitions and targets.  Adjust table/column names if
-- different in your schema.  These entries allow KPI pages to display both
-- manual and calculated metrics.
-- -----------------------------------------------------------------------------

insert into kpi_metrics (metric_id, metric_name, description, data_type)
values
  ('total_revenue', 'Total Revenue', 'Total invoice amount collected', 'currency'),
  ('first_response_time', 'Median First Response Time', 'Median minutes to respond to tickets', 'integer')
on conflict (metric_id) do nothing;

insert into kpi_targets (target_id, metric_id, period_start, period_end, target_value, assigned_to)
values
  (gen_random_uuid(), 'total_revenue', date_trunc('year', current_date), date_trunc('year', current_date) + interval '1 year' - interval '1 day', 100000000, (select user_id from profiles where email = 'salesmgr@test.ugc')),
  (gen_random_uuid(), 'first_response_time', date_trunc('month', current_date), date_trunc('month', current_date) + interval '1 month' - interval '1 day', 30, (select user_id from profiles where email = 'eximops@test.ugc'))
on conflict do nothing;

-- Insert manual KPI input event
insert into kpi_inputs (input_id, metric_id, occurred_at, value, created_by)
values (gen_random_uuid(), 'total_revenue', current_timestamp, 7500000, (select user_id from profiles where email = 'finance@test.ugc'));

-- -----------------------------------------------------------------------------
-- 7. Marketing spend
--
-- Insert a few marketing events to test the marketing spend view/policies.
-- -----------------------------------------------------------------------------

insert into marketing_spend (event_id, spend_date, channel, amount, description, created_by)
values
  (gen_random_uuid(), current_date - 5, 'Google Ads', 2000000, 'Paid search campaign', (select user_id from profiles where email = 'marcomm@test.ugc')),
  (gen_random_uuid(), current_date - 12, 'Social Media', 1000000, 'Instagram promotion', (select user_id from profiles where email = 'macx@test.ugc'))
on conflict do nothing;

-- End of seed script