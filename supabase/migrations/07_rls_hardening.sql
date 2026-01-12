-- ============================================================================
-- UGC Integrated Dashboard – RLS Hardening Migration
-- File: 07_rls_hardening.sql
-- Purpose: Harden RLS policies and RPC security for kpi_actuals table
-- ============================================================================

-- ================================================================
-- PART 1: ENABLE RLS ON kpi_actuals (if not already enabled)
-- ================================================================

alter table if exists public.kpi_actuals enable row level security;

-- ================================================================
-- PART 2: DROP AND RECREATE RLS POLICIES FOR kpi_actuals
-- More restrictive policies with ownership checks
-- ================================================================

-- Drop existing policies
drop policy if exists kpi_actuals_select on public.kpi_actuals;
drop policy if exists kpi_actuals_insert on public.kpi_actuals;
drop policy if exists kpi_actuals_update on public.kpi_actuals;
drop policy if exists kpi_actuals_delete on public.kpi_actuals;
drop policy if exists kpi_actuals_select_own on public.kpi_actuals;
drop policy if exists kpi_actuals_insert_own on public.kpi_actuals;
drop policy if exists kpi_actuals_update_own on public.kpi_actuals;
drop policy if exists kpi_actuals_delete_admin on public.kpi_actuals;

-- SELECT: Users can only see their own records, except managers/admin
create policy kpi_actuals_select on public.kpi_actuals
for select using (
  auth.uid() = user_id
  or public.app_is_super_admin()
  or public.app_is_director()
  or public.app_current_role() in ('Marketing Manager', 'sales manager')
);

-- INSERT: Users can only insert records for themselves
create policy kpi_actuals_insert on public.kpi_actuals
for insert with check (
  auth.uid() = user_id
);

-- UPDATE: Users can only update their own records
create policy kpi_actuals_update on public.kpi_actuals
for update using (
  auth.uid() = user_id
) with check (
  auth.uid() = user_id
);

-- DELETE: Only super admin can delete
create policy kpi_actuals_delete on public.kpi_actuals
for delete using (
  public.app_is_super_admin()
);

-- ================================================================
-- PART 3: HARDEN kpi_update_manual_progress RPC
-- Set search_path to public, pg_temp to prevent search_path manipulation
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
set search_path = public, pg_temp
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
  if not exists (select 1 from public.kpi_metric_definitions where metric_key = p_metric_key) then
    return jsonb_build_object('success', false, 'error', 'Invalid metric_key');
  end if;

  -- Validate period
  if p_period_start > p_period_end then
    return jsonb_build_object('success', false, 'error', 'period_start must be <= period_end');
  end if;

  -- Validate value is non-negative
  if p_value < 0 then
    return jsonb_build_object('success', false, 'error', 'value must be non-negative');
  end if;

  -- Upsert kpi_actuals (atomic)
  insert into public.kpi_actuals (metric_key, period_start, period_end, value, user_id, notes)
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
-- PART 4: HARDEN kpi_get_auto_value RPC
-- Set search_path to public, pg_temp
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
set search_path = public, pg_temp
as $$
declare
  v_result numeric := 0;
begin
  -- Input validation
  if p_metric_key is null or p_period_start is null or p_period_end is null then
    return 0;
  end if;

  if p_period_start > p_period_end then
    return 0;
  end if;

  -- Sales Revenue
  if p_metric_key = 'SALES_REVENUE' then
    select coalesce(sum(revenue_idr), 0) into v_result
    from public.v_sales_revenue_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Sales New Logos
  if p_metric_key = 'SALES_NEW_LOGOS' then
    select coalesce(sum(new_logos), 0) into v_result
    from public.v_sales_new_logos_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Sales Active Customers
  if p_metric_key = 'SALES_ACTIVE_CUSTOMERS' then
    select coalesce(sum(active_customers), 0) into v_result
    from public.v_sales_revenue_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Marketing Leads by Channel (total)
  if p_metric_key = 'MKT_LEADS_BY_CHANNEL' then
    select coalesce(sum(leads_count), 0) into v_result
    from public.v_marketing_leads_by_channel_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Sales Activity Visit
  if p_metric_key = 'SALES_ACTIVITY_VISIT' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Visit'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Visit';
    end if;
    return v_result;
  end if;

  -- Sales Activity Call
  if p_metric_key = 'SALES_ACTIVITY_CALL' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Call'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Call';
    end if;
    return v_result;
  end if;

  -- Sales Activity Online Meeting
  if p_metric_key = 'SALES_ACTIVITY_ONLINE_MEETING' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Online Meeting'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Online Meeting';
    end if;
    return v_result;
  end if;

  -- Sales Activity Email
  if p_metric_key = 'SALES_ACTIVITY_EMAIL' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Email'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'Email';
    end if;
    return v_result;
  end if;

  -- Sales Activity WhatsApp
  if p_metric_key = 'SALES_ACTIVITY_WA_OUTBOUND' then
    if p_user_id is not null then
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'WhatsApp/Chat Outbound'
        and user_id = p_user_id;
    else
      select coalesce(sum(activity_count), 0) into v_result
      from public.v_sales_activities_daily
      where day >= p_period_start and day <= p_period_end
        and activity_type = 'WhatsApp/Chat Outbound';
    end if;
    return v_result;
  end if;

  -- Sales DSO Days
  if p_metric_key = 'SALES_DSO_DAYS' then
    select coalesce(dso_days_rolling_30, 0) into v_result
    from public.v_dso_rolling_30
    limit 1;
    return v_result;
  end if;

  -- Sales Overdue AR
  if p_metric_key = 'SALES_OVERDUE_AR' then
    select coalesce(sum(outstanding_amount), 0) into v_result
    from public.v_invoice_outstanding
    where is_overdue = true;
    return v_result;
  end if;

  -- Sales Leads Assigned
  if p_metric_key = 'SALES_LEADS_ASSIGNED' then
    if p_user_id is not null then
      select count(*) into v_result
      from public.leads
      where sales_owner_user_id = p_user_id
        and lead_date >= p_period_start and lead_date <= p_period_end;
    else
      select count(*) into v_result
      from public.leads
      where sales_owner_user_id is not null
        and lead_date >= p_period_start and lead_date <= p_period_end;
    end if;
    return v_result;
  end if;

  -- Sales Leads Created Outbound
  if p_metric_key = 'SALES_LEADS_CREATED_OUTBOUND' then
    select count(*) into v_result
    from public.leads
    where primary_channel = 'Sales Outbound'
      and lead_date >= p_period_start and lead_date <= p_period_end;
    return v_result;
  end if;

  -- Marketing Spend by channel
  if p_metric_key like 'MARCOMM_%_SPEND' or p_metric_key like 'DGO_%_SPEND' then
    select coalesce(sum(spend_idr), 0) into v_result
    from public.v_marketing_spend_daily
    where day >= p_period_start and day <= p_period_end;
    return v_result;
  end if;

  -- Inquiry First Response (median minutes)
  if p_metric_key = 'SALES_INQUIRY_FIRST_RESPONSE_MEDIAN_MIN' then
    select coalesce(percentile_cont(0.5) within group (order by first_response_minutes), 0) into v_result
    from public.v_ticket_first_response
    where ticket_type = 'inquiry tariff'
      and ticket_created_at >= p_period_start and ticket_created_at <= p_period_end
      and first_response_minutes is not null;
    return v_result;
  end if;

  -- Default: return 0 for unsupported metrics
  return 0;
end $$;

-- ================================================================
-- PART 5: HARDEN CRM RPC FUNCTIONS
-- Set search_path to public, pg_temp
-- ================================================================

create or replace function public.crm_get_pipeline_stats(p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
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
    from public.v_leads_pipeline_stats;
  -- Salesperson: see only their own
  elsif v_role = 'salesperson' and p_user_id is not null then
    select jsonb_agg(
      jsonb_build_object(
        'status', status,
        'count', count(*)
      )
    ) into v_result
    from public.leads
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
    from public.v_leads_pipeline_stats;
  end if;

  return coalesce(v_result, '[]'::jsonb);
end $$;

create or replace function public.crm_check_duplicate(
  p_email text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_matches jsonb := '[]'::jsonb;
  v_lead_matches jsonb;
  v_customer_matches jsonb;
begin
  -- Input validation
  if (p_email is null or p_email = '') and (p_phone is null or p_phone = '') then
    return jsonb_build_object(
      'exists', false,
      'count', 0,
      'matches', '[]'::jsonb
    );
  end if;

  -- Check leads by email
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
    from public.leads
    where lower(email) = lower(p_email);

    v_matches := v_matches || v_lead_matches;
  end if;

  -- Check leads by phone
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
    from public.leads
    where contact_phone = p_phone
      and (p_email is null or lower(email) <> lower(p_email));

    v_matches := v_matches || v_lead_matches;
  end if;

  -- Check customers by email
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
    from public.customers
    where lower(pic_email) = lower(p_email);

    v_matches := v_matches || v_customer_matches;
  end if;

  -- Check customers by phone
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
    from public.customers
    where pic_phone = p_phone
      and (p_email is null or lower(pic_email) <> lower(p_email));

    v_matches := v_matches || v_customer_matches;
  end if;

  return jsonb_build_object(
    'exists', jsonb_array_length(v_matches) > 0,
    'count', jsonb_array_length(v_matches),
    'matches', v_matches
  );
end $$;

-- ================================================================
-- PART 6: GRANT EXECUTE PERMISSIONS
-- Only grant to authenticated role
-- ================================================================

-- Revoke any existing grants and re-grant to authenticated only
revoke all on function public.kpi_update_manual_progress(text, date, date, numeric, text) from public;
revoke all on function public.kpi_get_auto_value(text, date, date, uuid) from public;
revoke all on function public.crm_get_pipeline_stats(uuid) from public;
revoke all on function public.crm_check_duplicate(text, text) from public;

grant execute on function public.kpi_update_manual_progress(text, date, date, numeric, text) to authenticated;
grant execute on function public.kpi_get_auto_value(text, date, date, uuid) to authenticated;
grant execute on function public.crm_get_pipeline_stats(uuid) to authenticated;
grant execute on function public.crm_check_duplicate(text, text) to authenticated;

-- ================================================================
-- END OF MIGRATION
-- ================================================================
