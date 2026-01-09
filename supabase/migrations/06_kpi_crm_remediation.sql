-- ============================================================================
-- UGC Integrated Dashboard – KPI & CRM Remediation Migration (Jan 2026)
-- File: 06_kpi_crm_remediation.sql
-- ============================================================================

-- ================================================================
-- PART 1: KPI ACTUALS TABLE
-- Stores manual progress values and actual values for KPI metrics
-- ================================================================

-- Create kpi_actuals table
create table if not exists public.kpi_actuals (
  actual_id uuid primary key default gen_random_uuid(),
  metric_key text not null references public.kpi_metric_definitions(metric_key),
  period_start date not null,
  period_end date not null,
  value numeric not null default 0,
  user_id uuid not null references public.profiles(user_id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add unique constraint for deduplication
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_kpi_actuals_metric_period_user'
  ) then
    alter table public.kpi_actuals
    add constraint uq_kpi_actuals_metric_period_user
    unique (metric_key, period_start, period_end, user_id);
  end if;
end $$;

-- Create indexes for performance
create index if not exists idx_kpi_actuals_metric on public.kpi_actuals(metric_key);
create index if not exists idx_kpi_actuals_user on public.kpi_actuals(user_id);
create index if not exists idx_kpi_actuals_period on public.kpi_actuals(period_start, period_end);

-- Create updated_at trigger
create or replace function public.trg_kpi_actuals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_kpi_actuals_updated_at on public.kpi_actuals;
create trigger trg_kpi_actuals_updated_at
before update on public.kpi_actuals
for each row execute function public.trg_kpi_actuals_updated_at();

-- ================================================================
-- PART 2: KPI UPDATE MANUAL PROGRESS RPC
-- Atomic upsert for manual KPI progress tracking
-- ================================================================

create or replace function public.kpi_update_manual_progress(
  p_metric_key text,
  p_period_start date,
  p_period_end date,
  p_value numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_actual_id uuid;
begin
  -- Validate auth
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Validate metric_key exists
  if not exists (select 1 from kpi_metric_definitions where metric_key = p_metric_key) then
    return jsonb_build_object('success', false, 'error', 'Invalid metric_key');
  end if;

  -- Validate period
  if p_period_start > p_period_end then
    return jsonb_build_object('success', false, 'error', 'period_start must be <= period_end');
  end if;

  -- Upsert kpi_actuals (atomic)
  insert into kpi_actuals (metric_key, period_start, period_end, value, user_id, notes)
  values (p_metric_key, p_period_start, p_period_end, p_value, v_user_id, p_notes)
  on conflict on constraint uq_kpi_actuals_metric_period_user
  do update set
    value = excluded.value,
    notes = excluded.notes,
    updated_at = now()
  returning actual_id into v_actual_id;

  return jsonb_build_object(
    'success', true,
    'actual_id', v_actual_id,
    'metric_key', p_metric_key,
    'value', p_value
  );
end $$;

-- ================================================================
-- PART 3: KPI AUTO-CALC FUNCTION
-- Returns calculated value from internal views for AUTO metrics
-- ================================================================

create or replace function public.kpi_get_auto_value(
  p_metric_key text,
  p_period_start date,
  p_period_end date,
  p_user_id uuid default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result numeric := 0;
begin
  -- Sales Revenue
  if p_metric_key = 'SALES_REVENUE' then
    select coalesce(sum(revenue_idr), 0) into v_result
    from v_sales_revenue_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Sales New Logos
  if p_metric_key = 'SALES_NEW_LOGOS' then
    select coalesce(sum(new_logos), 0) into v_result
    from v_sales_new_logos_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Sales Active Customers
  if p_metric_key = 'SALES_ACTIVE_CUSTOMERS' then
    select coalesce(sum(active_customers), 0) into v_result
    from v_sales_revenue_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Marketing Leads by Channel (total)
  if p_metric_key = 'MKT_LEADS_BY_CHANNEL' then
    select coalesce(sum(leads_count), 0) into v_result
    from v_marketing_leads_by_channel_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Sales Activity Visit
  if p_metric_key = 'SALES_ACTIVITY_VISIT' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Visit'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Visit';
    end if;
    return v_result;
  end if;

  -- Sales Activity Call
  if p_metric_key = 'SALES_ACTIVITY_CALL' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Call'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Call';
    end if;
    return v_result;
  end if;

  -- Sales Activity Online Meeting
  if p_metric_key = 'SALES_ACTIVITY_ONLINE_MEETING' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Online Meeting'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Online Meeting';
    end if;
    return v_result;
  end if;

  -- Sales Activity Email
  if p_metric_key = 'SALES_ACTIVITY_EMAIL' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Email'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Email';
    end if;
    return v_result;
  end if;

  -- Sales Activity WhatsApp
  if p_metric_key = 'SALES_ACTIVITY_WA_OUTBOUND' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'WhatsApp/Chat Outbound'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'WhatsApp/Chat Outbound';
    end if;
    return v_result;
  end if;

  -- Sales DSO Days
  if p_metric_key = 'SALES_DSO_DAYS' then
    select coalesce(dso_days_rolling_30, 0) into v_result
    from v_dso_rolling_30
    limit 1;
    return v_result;
  end if;

  -- Sales Overdue AR
  if p_metric_key = 'SALES_OVERDUE_AR' then
    select coalesce(sum(outstanding_amount), 0) into v_result
    from v_invoice_outstanding
    where is_overdue = true;
    return v_result;
  end if;

  -- Sales Leads Assigned
  if p_metric_key = 'SALES_LEADS_ASSIGNED' then
    if p_user_id is not null then
      select count(*) into v_result
      from leads
      where sales_owner_user_id = p_user_id
        and lead_date >= p_period_start and lead_date <= p_period_end;
    else
      select count(*) into v_result
      from leads
      where sales_owner_user_id is not null
        and lead_date >= p_period_start and lead_date <= p_period_end;
    end if;
    return v_result;
  end if;

  -- Sales Leads Created Outbound
  if p_metric_key = 'SALES_LEADS_CREATED_OUTBOUND' then
    select count(*) into v_result
    from leads
    where primary_channel = 'Sales Outbound'
      and lead_date >= p_period_start and lead_date <= p_period_end;
    return v_result;
  end if;

  -- Marketing Spend by channel (for MARCOMM_SEM_SPEND etc - even though MANUAL, provide fallback)
  if p_metric_key like 'MARCOMM_%_SPEND' or p_metric_key like 'DGO_%_SPEND' then
    select coalesce(sum(spend_idr), 0) into v_result
    from v_marketing_spend_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Inquiry First Response (median minutes)
  if p_metric_key = 'SALES_INQUIRY_FIRST_RESPONSE_MEDIAN_MIN' then
    select coalesce(percentile_cont(0.5) within group (order by first_response_minutes), 0) into v_result
    from v_ticket_first_response
    where ticket_type = 'inquiry tariff'
      and ticket_created_at >= p_period_start and ticket_created_at <= p_period_end
      and first_response_minutes is not null;
    return v_result;
  end if;

  -- Default: return 0 for unsupported metrics
  return 0;
end $$;

-- ================================================================
-- PART 4: RLS POLICIES FOR kpi_actuals
-- ================================================================

-- Enable RLS
alter table public.kpi_actuals enable row level security;

-- Drop existing policies if any
drop policy if exists kpi_actuals_select_own on public.kpi_actuals;
drop policy if exists kpi_actuals_insert_own on public.kpi_actuals;
drop policy if exists kpi_actuals_update_own on public.kpi_actuals;
drop policy if exists kpi_actuals_delete_admin on public.kpi_actuals;

-- SELECT: owner can see own, super admin/director/managers can see all
create policy kpi_actuals_select_own on public.kpi_actuals
for select using (
  user_id = auth.uid()
  or public.app_is_super_admin()
  or public.app_is_director()
  or public.app_current_role() in ('Marketing Manager', 'sales manager')
);

-- INSERT: owner only (via RPC - but also allow direct for flexibility)
create policy kpi_actuals_insert_own on public.kpi_actuals
for insert with check (
  user_id = auth.uid()
  or public.app_is_super_admin()
);

-- UPDATE: owner or super admin
create policy kpi_actuals_update_own on public.kpi_actuals
for update using (
  user_id = auth.uid()
  or public.app_is_super_admin()
);

-- DELETE: super admin only
create policy kpi_actuals_delete_admin on public.kpi_actuals
for delete using (
  public.app_is_super_admin()
);

-- ================================================================
-- PART 5: VIEW FOR KPI ACTUALS WITH AUTO-CALC
-- Combines manual actuals with auto-calculated values
-- ================================================================

create or replace view public.v_kpi_progress as
select
  t.id as target_id,
  t.metric_key,
  t.period_start,
  t.period_end,
  t.assignee_user_id,
  t.target_value,
  m.calc_method,
  m.direction,
  m.unit,
  -- Get actual value: prefer manual (kpi_actuals), fallback to auto-calc
  coalesce(
    a.value,
    case
      when m.calc_method = 'AUTO' then public.kpi_get_auto_value(t.metric_key, t.period_start, t.period_end, t.assignee_user_id)
      else 0
    end
  ) as actual_value,
  a.notes as actual_notes,
  a.updated_at as actual_updated_at
from kpi_targets t
join kpi_metric_definitions m on m.metric_key = t.metric_key
left join kpi_actuals a on (
  a.metric_key = t.metric_key
  and a.period_start = t.period_start
  and a.period_end = t.period_end
  and (
    a.user_id = t.assignee_user_id
    or (t.assignee_user_id is null and a.user_id = t.created_by)
  )
);

-- ================================================================
-- PART 6: CRM LEADS PIPELINE STATS VIEW
-- Pre-aggregated counts by status for efficient pipeline display
-- ================================================================

create or replace view public.v_leads_pipeline_stats as
select
  status,
  count(*) as lead_count,
  count(*) filter (where sales_owner_user_id is not null) as assigned_count,
  count(*) filter (where sales_owner_user_id is null) as unassigned_count
from leads
group by status;

-- ================================================================
-- PART 7: CRM LEADS SCOPED PIPELINE STATS FUNCTION
-- Returns pipeline stats scoped by user role
-- ================================================================

create or replace function public.crm_get_pipeline_stats(p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_role text;
begin
  -- Get caller's role
  select public.app_current_role() into v_role;

  -- Super admin / Director / Marketing Manager: see all
  if v_role in ('super admin', 'Director', 'Marketing Manager', 'sales manager') then
    select jsonb_agg(
      jsonb_build_object(
        'status', status,
        'count', lead_count,
        'assigned', assigned_count,
        'unassigned', unassigned_count
      )
    ) into v_result
    from v_leads_pipeline_stats;
  -- Salesperson: see only their own
  elsif v_role = 'salesperson' and p_user_id is not null then
    select jsonb_agg(
      jsonb_build_object(
        'status', status,
        'count', count(*)
      )
    ) into v_result
    from leads
    where sales_owner_user_id = p_user_id
    group by status;
  else
    -- Others: see all (can restrict further if needed)
    select jsonb_agg(
      jsonb_build_object(
        'status', status,
        'count', lead_count
      )
    ) into v_result
    from v_leads_pipeline_stats;
  end if;

  return coalesce(v_result, '[]'::jsonb);
end $$;

-- ================================================================
-- PART 8: CRM DEDUP CHECK FUNCTION
-- Returns existing matches for email/phone to prevent duplicates
-- ================================================================

create or replace function public.crm_check_duplicate(
  p_email text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_matches jsonb := '[]'::jsonb;
  v_lead_matches jsonb;
  v_customer_matches jsonb;
begin
  -- Check leads
  if p_email is not null and p_email <> '' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'lead',
        'id', lead_id,
        'company_name', company_name,
        'pic_name', pic_name,
        'email', email,
        'status', status,
        'match_field', 'email'
      )
    ), '[]'::jsonb) into v_lead_matches
    from leads
    where lower(email) = lower(p_email);

    v_matches := v_matches || v_lead_matches;
  end if;

  if p_phone is not null and p_phone <> '' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'lead',
        'id', lead_id,
        'company_name', company_name,
        'pic_name', pic_name,
        'phone', contact_phone,
        'status', status,
        'match_field', 'phone'
      )
    ), '[]'::jsonb) into v_lead_matches
    from leads
    where contact_phone = p_phone
      and (p_email is null or lower(email) <> lower(p_email)); -- avoid duplicate entries

    v_matches := v_matches || v_lead_matches;
  end if;

  -- Check customers
  if p_email is not null and p_email <> '' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'customer',
        'id', customer_id,
        'company_name', company_name,
        'pic_name', pic_name,
        'email', pic_email,
        'match_field', 'email'
      )
    ), '[]'::jsonb) into v_customer_matches
    from customers
    where lower(pic_email) = lower(p_email);

    v_matches := v_matches || v_customer_matches;
  end if;

  if p_phone is not null and p_phone <> '' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'customer',
        'id', customer_id,
        'company_name', company_name,
        'pic_name', pic_name,
        'phone', pic_phone,
        'match_field', 'phone'
      )
    ), '[]'::jsonb) into v_customer_matches
    from customers
    where pic_phone = p_phone
      and (p_email is null or lower(pic_email) <> lower(p_email)); -- avoid duplicate entries

    v_matches := v_matches || v_customer_matches;
  end if;

  return jsonb_build_object(
    'exists', jsonb_array_length(v_matches) > 0,
    'count', jsonb_array_length(v_matches),
    'matches', v_matches
  );
end $$;

-- ================================================================
-- END OF MIGRATION
-- ================================================================

-- Grant execute on functions to authenticated users
grant execute on function public.kpi_update_manual_progress to authenticated;
grant execute on function public.kpi_get_auto_value to authenticated;
grant execute on function public.crm_get_pipeline_stats to authenticated;
grant execute on function public.crm_check_duplicate to authenticated;

-- Grant select on views
grant select on public.v_kpi_progress to authenticated;
grant select on public.v_leads_pipeline_stats to authenticated;
