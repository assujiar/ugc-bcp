-- ============================================================================
-- UGC Integrated Dashboard – Incremental Migration Patch (Jan 2026) – v3
-- Corrected & hardened version
-- ============================================================================

-- ================================================================
-- Helper role predicates (defensive): app_current_role() + app_is_*
-- ================================================================

create or replace function public.app_current_role()
returns text
language plpgsql
stable
as $$
declare
  r text;
  has_profiles boolean;
  has_user_id boolean;
  has_id boolean;
  role_col text;
  sql text;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) into has_profiles;

  if not has_profiles then
    return null;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) into has_id;

  -- Determine role column name (supports role_name / role / user_role)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role_name'
  ) then
    role_col := 'role_name';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    role_col := 'role';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_role'
  ) then
    role_col := 'user_role';
  else
    return null;
  end if;

  -- If auth context is missing, return null early
  if auth.uid() is null then
    return null;
  end if;

  if has_user_id then
    sql := format('select p.%I from public.profiles p where p.user_id = $1 limit 1', role_col);
    execute sql into r using auth.uid();
  elsif has_id then
    sql := format('select p.%I from public.profiles p where p.id = $1 limit 1', role_col);
    execute sql into r using auth.uid();
  else
    return null;
  end if;

  return r;
end $$;


create or replace function public.app_is_super_admin()
returns boolean
language sql
stable
as $$
  select public.app_current_role() = 'super admin';
$$;


create or replace function public.app_is_director()
returns boolean
language sql
stable
as $$
  select public.app_current_role() = 'Director';
$$;


create or replace function public.app_is_marketing()
returns boolean
language sql
stable
as $$
  select public.app_current_role() in (
    'Marketing Manager',
    'Marcomm (marketing staff)',
    'DGO (Marketing staff)',
    'MACX (marketing staff)',
    'VSDO (marketing staff)'
  );
$$;


-- ================================================================
-- FIX_DSO_01: invoice_status enum + invoices.status (idempotent)
-- ================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('CREATED','SENT','WAITING_PAYMENT','PAID','VOID');
  end if;
end $$;

-- Add column if invoices table exists
do $$
begin
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'status'
    ) THEN
      execute 'alter table public.invoices add column status public.invoice_status not null default ''CREATED''::public.invoice_status';
    ELSE
      -- Ensure default is explicitly cast
      execute 'alter table public.invoices alter column status set default ''CREATED''::public.invoice_status';
      -- If column exists but not typed as invoice_status, try to alter type if safe
      -- (Skip automatic ALTER TYPE to avoid destructive conversions)
    END IF;
  END IF;
end $$;

-- Backfill status based on payments (safe, repeatable) only if invoices table exists and status column exists
do $$
begin
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'status') THEN
    -- Only update rows currently set to CREATED (explicitly cast to enum text for comparison)
    UPDATE public.invoices i
    SET status = CASE
      WHEN COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.invoice_id = i.invoice_id), 0) >= i.invoice_amount
        THEN 'PAID'::public.invoice_status
      WHEN COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.invoice_id = i.invoice_id), 0) > 0
        THEN 'WAITING_PAYMENT'::public.invoice_status
      ELSE 'CREATED'::public.invoice_status
    END
    WHERE i.status = 'CREATED'::public.invoice_status;
  END IF;
end $$;


-- ================================================================
-- FIX_DSO_02: v_invoice_aging view (idempotent)
-- ================================================================

create or replace view public.v_invoice_aging as
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
    when (i.invoice_amount - coalesce(sum(p.amount), 0)) <= 0 then 0
    when i.due_date is null then 0
    else greatest((current_date - i.due_date)::int, 0)
  end as days_overdue,
  case
    when (i.invoice_amount - coalesce(sum(p.amount), 0)) <= 0 then 'PAID'
    when i.due_date is null then 'CURRENT'
    when current_date <= i.due_date then 'CURRENT'
    when current_date - i.due_date <= 30 then '1-30'
    when current_date - i.due_date <= 60 then '31-60'
    when current_date - i.due_date <= 90 then '61-90'
    else '>90'
  end as aging_bucket
from public.invoices i
left join public.payments p on p.invoice_id = i.invoice_id
group by
  i.invoice_id,
  i.customer_id,
  i.invoice_date,
  i.due_date,
  i.invoice_amount,
  i.currency,
  i.status;


-- ================================================================
-- FIX_SLA_01: First response SLA events
-- ================================================================

-- Create trigger function only if sla_events and ticket_messages/tickets exist (function will be created regardless; triggers created conditionally)
create or replace function public.trg_sla_first_response()
returns trigger
language plpgsql
as $$
begin
  -- defensive: ensure NEW has created_by and ticket_id
  if new is null then
    return null;
  end if;

  if new.created_by is not null then
    if not exists (
      select 1 from public.sla_events se
      where se.ticket_id = new.ticket_id and se.event_type = 'FIRST_RESPONSE'
    ) then
      if exists (
        select 1
        from public.tickets t
        where t.ticket_id = new.ticket_id
          and t.created_by IS DISTINCT FROM new.created_by
      ) then
        insert into public.sla_events(ticket_id, event_type, metadata)
        values (new.ticket_id, 'FIRST_RESPONSE', jsonb_build_object('responded_by', new.created_by));
      end if;
    end if;
  end if;

  return new;
end $$;

-- Create trigger only if ticket_messages table exists and sla_events exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ticket_messages')
    and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sla_events') then
    execute 'drop trigger if exists trg_sla_first_response on public.ticket_messages';
    execute 'create trigger trg_sla_first_response after insert on public.ticket_messages for each row execute function public.trg_sla_first_response()';
  end if;
end $$;


-- ================================================================
-- FIX_SLA_02: Status change & resolved SLA events (casting enums to text)
-- ================================================================

create or replace function public.trg_sla_status_change()
returns trigger
language plpgsql
as $$
declare
  from_status text;
  to_status text;
begin
  -- Defensive when OLD/NEW may be null
  if new is null then
    return null;
  end if;

  from_status := coalesce(old.inquiry_status::text, old.ticket_status::text, '');
  to_status   := coalesce(new.inquiry_status::text, new.ticket_status::text, '');

  if from_status IS DISTINCT FROM to_status then
    insert into public.sla_events(ticket_id, event_type, metadata)
    values (new.ticket_id, 'STATUS_CHANGE', jsonb_build_object('from', from_status, 'to', to_status));

    if to_status = 'CLOSED' or to_status = 'CLOSED LOST' then
      insert into public.sla_events(ticket_id, event_type, metadata)
      values (new.ticket_id, 'RESOLVED', jsonb_build_object('resolved_status', to_status));
    end if;
  end if;

  return new;
end $$;

-- Create trigger only if tickets and sla_events exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tickets')
    and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sla_events') then
    execute 'drop trigger if exists trg_sla_status_change on public.tickets';
    execute 'create trigger trg_sla_status_change after update on public.tickets for each row when ((old.inquiry_status is distinct from new.inquiry_status) or (old.ticket_status is distinct from new.ticket_status)) execute function public.trg_sla_status_change()';
  end if;
end $$;


-- ================================================================
-- FIX_FIN_01: Atomic RPC for invoice & optional payment (defensive)
-- ================================================================

create or replace function public.finance_create_invoice_with_payment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id text;
  v_payment_id bigint := null;
  v_invoice record;
  v_payment_amount numeric := null;
begin
  -- Validate required invoice fields
  if payload is null then
    raise exception 'payload is required';
  end if;

  if coalesce(nullif(payload->>'customer_id',''), '') = '' then
    raise exception 'customer_id is required';
  end if;

  if payload->>'invoice_date' is null or payload->>'due_date' is null then
    raise exception 'invoice_date and due_date are required';
  end if;

  if payload->>'invoice_amount' is null or trim(payload->>'invoice_amount') = '' then
    raise exception 'invoice_amount is required';
  end if;

  -- Safe parse payment amount (NULL if missing/empty/whitespace)
  if payload ? 'payment_amount' then
    begin
      v_payment_amount := nullif(trim(payload->>'payment_amount'), '')::numeric;
    exception when others then
      -- If parse fails, treat as null (safe behavior)
      v_payment_amount := null;
    end;
  end if;

  insert into public.invoices (
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
    coalesce(nullif(payload->>'currency',''), 'IDR'),
    nullif(payload->>'notes',''),
    payload->>'customer_id',
    auth.uid(),
    case when v_payment_amount is null then 'CREATED'::public.invoice_status else 'WAITING_PAYMENT'::public.invoice_status end
  ) returning * into v_invoice;

  v_invoice_id := v_invoice.invoice_id;

  if v_payment_amount is not null then
    insert into public.payments (
      invoice_id,
      payment_date,
      amount,
      payment_method,
      reference_no,
      notes,
      created_by
    ) values (
      v_invoice_id,
      coalesce(nullif(payload->>'payment_date','')::date, current_date),
      v_payment_amount,
      nullif(payload->>'payment_method',''),
      nullif(payload->>'payment_reference',''),
      nullif(payload->>'payment_notes',''),
      auth.uid()
    ) returning payment_id into v_payment_id;

    update public.invoices
    set status = 'PAID'::public.invoice_status
    where invoice_id = v_invoice_id
      and v_payment_amount >= v_invoice.invoice_amount;
  end if;

  return jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'payment_id', v_payment_id,
    'status', (select i.status::text from public.invoices i where i.invoice_id = v_invoice_id)
  );
end $$;


-- ================================================================
-- FIX_SEC_01: RLS policies (audit_logs, imports, marketing_spend)
-- ================================================================

-- Audit logs: only super admin and director may read (if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_logs') then
    execute 'drop policy if exists audit_logs_select_admin on public.audit_logs';
    execute 'create policy audit_logs_select_admin on public.audit_logs for select using (public.app_is_super_admin() or public.app_is_director())';
  end if;
end $$;

-- Imports: create policies using the correct owner column.
do $$
declare
  has_uploaded_by boolean;
  has_created_by boolean;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'imports') then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'imports' and column_name = 'uploaded_by'
    ) into has_uploaded_by;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'imports' and column_name = 'created_by'
    ) into has_created_by;

    -- drop existing policies safely
    execute 'drop policy if exists imports_select_creator on public.imports';
    execute 'drop policy if exists imports_insert_creator on public.imports';

    if has_uploaded_by then
      execute 'create policy imports_select_creator on public.imports for select using (auth.uid() = uploaded_by OR public.app_is_super_admin())';
      execute 'create policy imports_insert_creator on public.imports for insert with check (auth.uid() = uploaded_by OR public.app_is_super_admin())';
    elsif has_created_by then
      execute 'create policy imports_select_creator on public.imports for select using (auth.uid() = created_by OR public.app_is_super_admin())';
      execute 'create policy imports_insert_creator on public.imports for insert with check (auth.uid() = created_by OR public.app_is_super_admin())';
    else
      raise notice 'Skipping imports policies: imports table has neither uploaded_by nor created_by';
    end if;
  end if;
end $$;

-- Marketing spend: allow marketing roles to read/insert (if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'marketing_spend') then
    execute 'drop policy if exists marketing_spend_select_marketing on public.marketing_spend';
    execute 'create policy marketing_spend_select_marketing on public.marketing_spend for select using (public.app_is_marketing() OR public.app_is_super_admin())';

    execute 'drop policy if exists marketing_spend_insert_marketing on public.marketing_spend';
    execute 'create policy marketing_spend_insert_marketing on public.marketing_spend for insert with check (public.app_is_marketing() OR public.app_is_super_admin())';
  end if;
end $$;


-- ================================================================
-- FIX_TKT_01: Require close_reason when inquiry_status = 'CLOSED LOST'
-- ================================================================

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tickets') then
    -- Drop existing constraint if present
    execute 'alter table public.tickets drop constraint if exists ck_tickets_close_reason';

    -- Add constraint (NOT VALID so it won't fail on legacy rows)
    execute 'alter table public.tickets add constraint ck_tickets_close_reason check (inquiry_status <> ''CLOSED LOST'' or close_reason is not null) not valid';
  end if;
end $$;
