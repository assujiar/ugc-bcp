-- supabase/migrations/09_fix_rls_recursion.sql
-- Fix infinite recursion in RLS helper functions
--
-- Problem: The RLS policies on `profiles` table call helper functions like
-- `app_is_super_admin()` which internally query the `profiles` table.
-- This causes infinite recursion when RLS evaluates these policies.
--
-- Solution: Make the helper functions use SECURITY DEFINER so they bypass
-- RLS when querying the profiles table internally.
--
-- Note: Using CREATE OR REPLACE instead of DROP to preserve dependent policies.

-- =========================================================
-- Recreate helper functions with SECURITY DEFINER
-- Using CREATE OR REPLACE to preserve dependent RLS policies
-- =========================================================

-- app_current_role: Get the current user's role from profiles
-- SECURITY DEFINER allows this to bypass RLS
create or replace function app_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role_name
  from profiles p
  where p.user_id = auth.uid()
$$;

-- app_current_dept: Get the current user's department from profiles
create or replace function app_current_dept()
returns dept_code
language sql
stable
security definer
set search_path = public
as $$
  select p.dept_code
  from profiles p
  where p.user_id = auth.uid()
$$;

-- app_is_role: Check if current user has a specific role
create or replace function app_is_role(role_in text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app_current_role() = role_in, false)
$$;

-- app_is_any_role: Check if current user has any of the specified roles
create or replace function app_is_any_role(roles_in text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app_current_role() = any(roles_in), false)
$$;

-- app_is_authenticated: Check if there's an authenticated user
create or replace function app_is_authenticated()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
$$;

-- app_is_marketing: Check if user is in marketing department
create or replace function app_is_marketing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_is_any_role(array[
    'Marketing Manager',
    'Marcomm (marketing staff)',
    'DGO (Marketing staff)',
    'MACX (marketing staff)',
    'VSDO (marketing staff)'
  ])
$$;

-- app_is_sales: Check if user is in sales department
create or replace function app_is_sales()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_is_any_role(array[
    'sales manager',
    'salesperson',
    'sales support'
  ])
$$;

-- app_is_ops: Check if user is in operations department
create or replace function app_is_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_is_any_role(array[
    'EXIM Ops (operation)',
    'domestics Ops (operation)',
    'Import DTD Ops (operation)',
    'traffic & warehous (operation)'
  ])
$$;

-- app_is_super_admin: Check if user is super admin
create or replace function app_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_is_role('super admin')
$$;

-- app_is_director: Check if user is director
create or replace function app_is_director()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_is_role('Director')
$$;

-- app_is_my_team_member: Check if a user_id is a team member of current user
create or replace function app_is_my_team_member(user_id_in uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles m
    where m.user_id = user_id_in
      and m.manager_user_id = auth.uid()
  )
$$;

-- Grant execute permissions to authenticated users
grant execute on function app_current_role() to authenticated;
grant execute on function app_current_dept() to authenticated;
grant execute on function app_is_role(text) to authenticated;
grant execute on function app_is_any_role(text[]) to authenticated;
grant execute on function app_is_authenticated() to authenticated;
grant execute on function app_is_marketing() to authenticated;
grant execute on function app_is_sales() to authenticated;
grant execute on function app_is_ops() to authenticated;
grant execute on function app_is_super_admin() to authenticated;
grant execute on function app_is_director() to authenticated;
grant execute on function app_is_my_team_member(uuid) to authenticated;

-- Also grant to anon for initial auth checks
grant execute on function app_current_role() to anon;
grant execute on function app_current_dept() to anon;
grant execute on function app_is_role(text) to anon;
grant execute on function app_is_any_role(text[]) to anon;
grant execute on function app_is_authenticated() to anon;
grant execute on function app_is_marketing() to anon;
grant execute on function app_is_sales() to anon;
grant execute on function app_is_ops() to anon;
grant execute on function app_is_super_admin() to anon;
grant execute on function app_is_director() to anon;
grant execute on function app_is_my_team_member(uuid) to anon;
