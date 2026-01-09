-- ============================================================================
-- UGC Integrated Dashboard – Incremental Migration Patch (Jan 2026)
--
-- This patch introduces several small, stable changes to address critical
-- deficiencies identified during QA remediation.  It should be executed
-- after running the baseline migrations (00_schema.sql … 04_tests.sql).
--
-- Changes:
--   FIX_DSO_01 – add invoice_status enum and status column
--   FIX_DSO_02 – create view v_invoice_aging
--   FIX_SLA_01 – triggers for first‑response SLA events
--   FIX_SLA_02 – triggers for status‑change and resolved SLA events
--   FIX_FIN_01 – RPC to create invoice with optional payment atomically
--   FIX_SEC_01 – RLS policies on audit_logs, imports and marketing_spend
--   FIX_TKT_01 – require close_reason when inquiry_status = 'CLOSED LOST'
-- ============================================================================

-- ================================================================
-- FIX_DSO_01: Invoice status enumeration and status column
--
-- Create an enum type to represent the lifecycle of an invoice.  The
-- default status is 'CREATED' (invoice drafted), then it can be 'SENT'
-- (sent to customer), 'WAITING_PAYMENT', 'PAID' or 'VOID'.  Adding this
-- column allows the UI and views to display the current state of each
-- invoice.  Existing invoices will default to CREATED.
-- ================================================================

do $$
begin
  -- Only create the type if it does not exist
  if not exists (
    select 1 from pg_type where typname = 'invoice_status'
  ) then
    create type invoice_status as enum ('CREATED','SENT','WAITING_PAYMENT','PAID','VOID');
  end if;
end $$;

alter table if exists invoices
  add column if not exists status invoice_status not null default 'CREATED';

-- Optionally update existing rows to WAITING_PAYMENT when they have
-- payments recorded; this script assumes outstanding = invoice_amount - sum(payments) > 0.
update invoices i
set status = case
  when coalesce((select sum(amount) from payments p where p.invoice_id = i.invoice_id),0) >= i.invoice_amount
    then 'PAID'
  when coalesce((select sum(amount) from payments p where p.invoice_id = i.invoice_id),0) > 0
    then 'WAITING_PAYMENT'
  else 'CREATED'
end
where status = 'CREATED';

-- ================================================================
-- FIX_DSO_02: View for invoice ageing and outstanding amounts
--
-- This view computes the outstanding balance, days overdue and ageing
-- buckets for each invoice.  It also propagates the invoice status.
-- ================================================================

create or replace view v_invoice_aging as
select
  i.invoice_id,
  i.customer_id,
  i.invoice_date,
  i.due_date,
  i.invoice_amount,
  i.currency,
  i.status,
  coalesce(sum(p.amount), 0) as amount_paid,
  i.invoice_amount - coalesce(sum(p.amount), 0) as outstanding,
  case
    when (i.invoice_amount - coalesce(sum(p.amount),0)) <= 0 then 0
    else greatest((current_date - i.due_date)::int, 0)
  end as days_overdue,
  case
    when (i.invoice_amount - coalesce(sum(p.amount),0)) <= 0 then 'PAID'
    when current_date <= i.due_date then 'CURRENT'
    when current_date - i.due_date <= 30 then '1-30'
    when current_date - i.due_date <= 60 then '31-60'
    when current_date - i.due_date <= 90 then '61-90'
    else '>90'
  end as aging_bucket
from invoices i
left join payments p on p.invoice_id = i.invoice_id
group by
  i.invoice_id,
  i.customer_id,
  i.invoice_date,
  i.due_date,
  i.invoice_amount,
  i.currency,
  i.status;

-- ================================================================
-- FIX_SLA_01: Trigger for first response SLA events
--
-- Inserts a FIRST_RESPONSE event when a ticket receives its first
-- message from someone other than the ticket creator.  It avoids
-- duplicate events by checking existing sla_events.
-- ================================================================

create or replace function trg_sla_first_response()
returns trigger
language plpgsql
as $$
begin
  -- Only insert if no first response exists and responder is not the creator
  if new.created_by is not null then
    if not exists (
      select 1 from sla_events se
      where se.ticket_id = new.ticket_id and se.event_type = 'FIRST_RESPONSE'
    ) then
      -- Fetch the ticket creator
      if exists (
        select 1 from tickets t where t.ticket_id = new.ticket_id and t.created_by <> new.created_by
      ) then
        insert into sla_events(ticket_id, event_type, metadata)
        values (new.ticket_id, 'FIRST_RESPONSE', jsonb_build_object('responded_by', new.created_by));
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_sla_first_response on ticket_messages;
create trigger trg_sla_first_response
after insert on ticket_messages
for each row execute function trg_sla_first_response();

-- ================================================================
-- FIX_SLA_02: Trigger for status change & resolved SLA events
--
-- Inserts STATUS_CHANGE on any transition of ticket_status or
-- inquiry_status.  Inserts RESOLVED when the new status is CLOSED or
-- CLOSED LOST.
-- ================================================================

create or replace function trg_sla_status_change()
returns trigger
language plpgsql
as $$
declare
  from_status text;
  to_status text;
begin
  from_status := coalesce(coalesce(old.inquiry_status, old.ticket_status), '');
  to_status := coalesce(coalesce(new.inquiry_status, new.ticket_status), '');

  if from_status is distinct from to_status then
    insert into sla_events(ticket_id, event_type, metadata)
    values (new.ticket_id, 'STATUS_CHANGE', jsonb_build_object('from', from_status, 'to', to_status));
    if to_status = 'CLOSED' or to_status = 'CLOSED LOST' then
      insert into sla_events(ticket_id, event_type, metadata)
      values (new.ticket_id, 'RESOLVED', jsonb_build_object('resolved_status', to_status));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_sla_status_change on tickets;
create trigger trg_sla_status_change
after update on tickets
for each row
when (old.inquiry_status is distinct from new.inquiry_status or old.ticket_status is distinct from new.ticket_status)
execute function trg_sla_status_change();

-- ================================================================
-- FIX_FIN_01: Atomic RPC for invoice & optional payment
--
-- This RPC accepts a JSON payload with invoice fields and optionally
-- payment fields.  It creates an invoice (generating invoice_id via
-- next_prefixed_id) and, if a payment amount is provided, inserts a
-- corresponding payment.  All operations occur in a single
-- transaction; on error the transaction rolls back.  It returns the
-- invoice and payment IDs along with the new status.
-- ================================================================

create or replace function finance_create_invoice_with_payment(payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_invoice_id text;
  v_payment_id bigint;
  v_invoice record;
begin
  -- Validate required invoice fields
  if payload->>'customer_id' is null or payload->>'customer_id' = '' then
    raise exception 'customer_id is required';
  end if;
  if payload->>'invoice_date' is null or payload->>'due_date' is null then
    raise exception 'invoice_date and due_date are required';
  end if;
  if payload->>'invoice_amount' is null then
    raise exception 'invoice_amount is required';
  end if;

  -- Insert invoice
  insert into invoices (
    invoice_date,
    due_date,
    invoice_amount,
    currency,
    notes,
    customer_id,
    created_by,
    status
  ) values (
    (payload->>'invoice_date')::date,
    (payload->>'due_date')::date,
    (payload->>'invoice_amount')::numeric,
    coalesce(payload->>'currency','IDR'),
    nullif(payload->>'notes',''),
    payload->>'customer_id',
    auth.uid(),
    case when (payload->>'payment_amount')::numeric is null then 'CREATED' else 'WAITING_PAYMENT' end
  ) returning * into v_invoice;

  v_invoice_id := v_invoice.invoice_id;

  -- Insert payment if provided
  if (payload->>'payment_amount')::numeric is not null then
    insert into payments (
      invoice_id,
      payment_date,
      amount,
      payment_method,
      reference_no,
      notes,
      created_by
    ) values (
      v_invoice_id,
      coalesce((payload->>'payment_date')::date, current_date),
      (payload->>'payment_amount')::numeric,
      nullif(payload->>'payment_method',''),
      nullif(payload->>'payment_reference',''),
      nullif(payload->>'payment_notes',''),
      auth.uid()
    ) returning payment_id into v_payment_id;

    -- Update invoice status if fully paid
    update invoices set status = 'PAID'
    where invoice_id = v_invoice_id
      and (payload->>'payment_amount')::numeric >= v_invoice.invoice_amount;
  end if;

  return jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'payment_id', v_payment_id,
    'status', (select status from invoices where invoice_id = v_invoice_id)
  );
end $$;

-- ================================================================
-- FIX_SEC_01: RLS Policies on audit_logs, imports and marketing_spend
--
-- The base migration enables RLS on these tables but doesn’t define
-- policies.  Without policies, even super admin cannot read them.  The
-- following policies grant select access to appropriate roles and leave
-- updates/inserts restricted.  Adjust as needed.
-- ================================================================

-- Audit logs: only super admin and director may read
drop policy if exists audit_logs_select_admin on audit_logs;
create policy audit_logs_select_admin
on audit_logs for select
using (app_is_super_admin() or app_is_director());

-- Imports: allow creator and super admin to select
drop policy if exists imports_select_creator on imports;
create policy imports_select_creator
on imports for select
using (auth.uid() = created_by or app_is_super_admin());

drop policy if exists imports_insert_creator on imports;
create policy imports_insert_creator
on imports for insert
with check (auth.uid() = created_by or app_is_super_admin());

-- Marketing spend: allow marketing roles to read/write
drop policy if exists marketing_spend_select_marketing on marketing_spend;
create policy marketing_spend_select_marketing
on marketing_spend for select
using (app_is_marketing() or app_is_super_admin());

drop policy if exists marketing_spend_insert_marketing on marketing_spend;
create policy marketing_spend_insert_marketing
on marketing_spend for insert
with check (app_is_marketing() or app_is_super_admin());

-- ================================================================
-- FIX_TKT_01: Database check for close_reason on CLOSED LOST
--
-- Enforce that close_reason must be supplied when inquiry_status =
-- 'CLOSED LOST'.  Although the API validates this, a DB constraint
-- prevents bypass via direct SQL.  Note: only applies to inquiry tickets.
-- ================================================================

alter table tickets
  add constraint if not exists ck_tickets_close_reason
  check (inquiry_status != 'CLOSED LOST' or close_reason is not null);
